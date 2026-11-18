import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  presignResourceDownload,
  RESOURCE_FILES_PREFIX,
} from "@/lib/resource-storage";

export const dynamic = "force-dynamic";

/**
 * Public delivery for uploaded documents. This route intentionally skips the
 * session check: anyone holding the unguessable file key can view the file.
 * Management (rename, move, delete) stays authenticated and owner-scoped.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/resources/public/[...key]">,
) {
  const key = (await ctx.params).key
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");

  if (
    !key.startsWith(RESOURCE_FILES_PREFIX) ||
    key.includes("..") ||
    key.includes("\\")
  ) {
    return new Response("Not found", { status: 404 });
  }

  const item = await db.resourceItem.findFirst({
    where: { fileKey: key },
    select: { title: true, fileName: true, mimeType: true },
  });
  if (!item) {
    return new Response("Not found", { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";

  try {
    const signedUrl = await presignResourceDownload(key, {
      fileName: item.fileName ?? item.title,
      contentType: item.mimeType ?? "application/octet-stream",
      download,
    });
    const response = NextResponse.redirect(signedUrl, 307);
    response.headers.set("Cache-Control", "public, max-age=300");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  } catch (err) {
    console.error("public resource download failed", err);
    return new Response("Document storage is unavailable.", { status: 503 });
  }
}
