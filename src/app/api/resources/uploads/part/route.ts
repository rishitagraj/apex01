import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import {
  isResourceFileKeyOwnedBy,
  RESOURCE_UPLOAD_MODE,
  uploadResourcePart,
} from "@/lib/resource-storage";
import { RESOURCE_UPLOAD_PART_SIZE } from "@/lib/resources";

/**
 * Relay uploads to storage when the provider cannot accept browser PUTs
 * (DBByte has no CORS for PUT). Bodies stay below Vercel's 4.5 MB request cap.
 */
export async function PUT(request: Request) {
  if (RESOURCE_UPLOAD_MODE !== "relay") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userId = await verifySession();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const uploadId = (url.searchParams.get("uploadId") ?? "").trim();
  const fileKey = (url.searchParams.get("fileKey") ?? "").trim();
  const partNumber = Number(url.searchParams.get("partNumber") ?? "");

  if (
    !uploadId ||
    uploadId.length > 500 ||
    !Number.isInteger(partNumber) ||
    partNumber < 1 ||
    partNumber > 10000
  ) {
    return NextResponse.json({ error: "Invalid upload part" }, { status: 400 });
  }

  if (!isResourceFileKeyOwnedBy(fileKey, userId)) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > RESOURCE_UPLOAD_PART_SIZE) {
    return NextResponse.json(
      { error: "Upload part is too large" },
      { status: 413 },
    );
  }

  let body: Uint8Array;
  try {
    body = new Uint8Array(await request.arrayBuffer());
  } catch (err) {
    console.error("resource upload part read failed", err);
    return NextResponse.json(
      { error: "Could not read that upload part. Please try again." },
      { status: 400 },
    );
  }

  if (body.byteLength < 1) {
    return NextResponse.json({ error: "Upload part is empty" }, { status: 400 });
  }
  if (body.byteLength > RESOURCE_UPLOAD_PART_SIZE) {
    return NextResponse.json(
      { error: "Upload part is too large" },
      { status: 413 },
    );
  }

  try {
    const etag = await uploadResourcePart(fileKey, uploadId, partNumber, body);
    return NextResponse.json({ ok: true, partNumber, etag });
  } catch (err) {
    console.error("resource upload part failed", err);
    return NextResponse.json(
      { error: "Could not upload that part. Please try again." },
      { status: 500 },
    );
  }
}
