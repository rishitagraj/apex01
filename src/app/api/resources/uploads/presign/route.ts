import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import {
  createResourceMultipartUpload,
  listResourceObjectsSize,
  newResourceFileKey,
  presignResourceUpload,
  resourceOwnerPrefix,
  RESOURCE_ALLOWED_MIMES,
  RESOURCE_STORAGE_TYPE_LABEL,
  RESOURCE_UPLOAD_MODE,
} from "@/lib/resource-storage";
import {
  normalizeUploadContentType,
  RESOURCE_STORAGE_QUOTA_BYTES,
  RESOURCE_UPLOAD_PART_SIZE,
} from "@/lib/resources";
import { resourceUploadPresignSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const userId = await verifySession();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = resourceUploadPresignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { fileName, contentType, fileSize } = parsed.data;
  const mimeType = normalizeUploadContentType(
    fileName,
    contentType,
    RESOURCE_ALLOWED_MIMES,
  );
  if (!mimeType) {
    return NextResponse.json(
      {
        error: `Unsupported file type. Choose ${RESOURCE_STORAGE_TYPE_LABEL}.`,
        code: "UNSUPPORTED_TYPE",
      },
      { status: 400 },
    );
  }

  try {
    const used = await listResourceObjectsSize(resourceOwnerPrefix(userId));
    if (used + fileSize > RESOURCE_STORAGE_QUOTA_BYTES) {
      return NextResponse.json(
        {
          error:
            "Your document storage is full. Delete a few uploaded files and try again.",
          code: "QUOTA_EXCEEDED",
        },
        { status: 409 },
      );
    }

    const fileKey = newResourceFileKey(userId, fileName);
    if (RESOURCE_UPLOAD_MODE === "relay") {
      const uploadId = await createResourceMultipartUpload(fileKey, mimeType);
      return NextResponse.json({
        ok: true,
        mode: "relay",
        uploadId,
        fileKey,
        contentType: mimeType,
        partSize: RESOURCE_UPLOAD_PART_SIZE,
      });
    }

    const uploadUrl = await presignResourceUpload(fileKey, mimeType, fileSize);

    return NextResponse.json({
      ok: true,
      mode: "direct",
      uploadUrl,
      fileKey,
      contentType: mimeType,
    });
  } catch (err) {
    const code = (err as { code?: string; name?: string }).code ?? "";
    const name = (err as { name?: string }).name ?? "";
    console.error("resource upload presign failed", err);
    if (code === "NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "Document storage is not configured.", code },
        { status: 503 },
      );
    }
    if (name === "NoSuchBucket" || name === "NotFound") {
      return NextResponse.json(
        {
          error: "Document storage is not available right now.",
          code: "STORAGE_MISSING",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Could not start the upload. Please try again." },
      { status: 500 },
    );
  }
}
