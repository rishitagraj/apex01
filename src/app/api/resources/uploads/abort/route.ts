import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import {
  abortResourceMultipartUpload,
  isResourceFileKeyOwnedBy,
  RESOURCE_UPLOAD_MODE,
} from "@/lib/resource-storage";
import { resourceUploadAbortSchema } from "@/lib/validation";

/** Drops an abandoned relayed upload so storage does not keep partial parts. */
export async function POST(request: Request) {
  if (RESOURCE_UPLOAD_MODE !== "relay") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userId = await verifySession();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = resourceUploadAbortSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  const { fileKey, uploadId } = parsed.data;
  if (!isResourceFileKeyOwnedBy(fileKey, userId)) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  try {
    await abortResourceMultipartUpload(fileKey, uploadId);
  } catch (err) {
    const name = (err as { name?: string }).name ?? "";
    // A missing upload is already gone; nothing left to clean up.
    if (name !== "NoSuchUpload" && name !== "NotFound") {
      console.error("resource upload abort failed", err);
    }
  }

  return NextResponse.json({ ok: true });
}
