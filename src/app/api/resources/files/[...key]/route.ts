import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import {
  presignResourceDownload,
  RESOURCE_FILES_PREFIX,
} from "@/lib/resource-storage";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/resources/files/[...key]">,
) {
  const userId = await verifySession();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const key = (await ctx.params).key
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");

  if (!key.startsWith(RESOURCE_FILES_PREFIX) || key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const item = await db.resourceItem.findFirst({
    where: { userId, fileKey: key },
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
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (err) {
    console.error("resource download failed", err);
    return new Response("Document storage is unavailable.", { status: 503 });
  }
}
