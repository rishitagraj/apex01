import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import {
  abortResourceMultipartUpload,
  completeResourceMultipartUpload,
  deleteResourceObject,
  headResourceObject,
  isResourceFileKeyOwnedBy,
  RESOURCE_ALLOWED_MIMES,
  RESOURCE_STORAGE_TYPE_LABEL,
  RESOURCE_UPLOAD_MODE,
} from "@/lib/resource-storage";
import {
  normalizeUploadContentType,
  resourceFileUrl,
  resourceKindForMime,
  RESOURCE_UPLOAD_MAX_BYTES,
} from "@/lib/resources";
import { resourceUploadCompleteSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const userId = await verifySession();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = resourceUploadCompleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { fileKey, fileName, contentType, folderId, title, notes, uploadId, parts } =
    parsed.data;

  if (!isResourceFileKeyOwnedBy(fileKey, userId)) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  const existing = await db.resourceItem.findUnique({ where: { fileKey } });
  if (existing) {
    if (existing.userId !== userId) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }
    return NextResponse.json({ item: existing });
  }

  if (folderId) {
    const folder = await db.resourceFolder.findFirst({
      where: { id: folderId, userId },
      select: { id: true },
    });
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
  }

  let object: { size: number; contentType: string };
  if (RESOURCE_UPLOAD_MODE === "relay") {
    if (!uploadId || !parts || parts.length === 0) {
      return NextResponse.json(
        { error: "That upload is incomplete. Please try again." },
        { status: 400 },
      );
    }

    const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    try {
      await completeResourceMultipartUpload(fileKey, uploadId, sorted);
    } catch (err) {
      // A retried completion can land after the upload already finished, so
      // verification below decides whether the object actually exists.
      console.error("resource multipart completion failed", err);
    }
  }

  try {
    object = await headResourceObject(fileKey);
  } catch (err) {
    console.error("resource upload verification failed", err);
    if (RESOURCE_UPLOAD_MODE === "relay" && uploadId) {
      await abortResourceMultipartUpload(fileKey, uploadId).catch(() => {});
    }
    return NextResponse.json(
      { error: "We could not verify that upload. Please try again." },
      { status: 400 },
    );
  }

  const mimeType = normalizeUploadContentType(
    fileName,
    object.contentType || contentType,
    RESOURCE_ALLOWED_MIMES,
  );
  if (!mimeType) {
    await deleteResourceObject(fileKey).catch(() => {});
    return NextResponse.json(
      {
        error: `Unsupported file type. Choose ${RESOURCE_STORAGE_TYPE_LABEL}.`,
        code: "UNSUPPORTED_TYPE",
      },
      { status: 400 },
    );
  }

  if (object.size < 1 || object.size > RESOURCE_UPLOAD_MAX_BYTES) {
    await deleteResourceObject(fileKey).catch(() => {});
    return NextResponse.json(
      { error: "Each file must be 25 MB or smaller." },
      { status: 400 },
    );
  }

  try {
    const item = await db.resourceItem.create({
      data: {
        userId,
        folderId: folderId ?? null,
        kind: resourceKindForMime(mimeType),
        title: title?.trim() || fileName,
        url: resourceFileUrl(fileKey),
        notes: notes?.trim() ? notes.trim() : null,
        fileKey,
        fileName,
        fileSize: object.size,
        mimeType,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    console.error("resource item create failed", err);
    await deleteResourceObject(fileKey).catch(() => {});
    return NextResponse.json(
      { error: "Could not save that file. Please try again." },
      { status: 500 },
    );
  }
}
