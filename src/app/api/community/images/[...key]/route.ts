import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { CHAT_IMAGES_PREFIX, getObjectBuffer } from "@/lib/b2";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ key: string[] }> },
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

  if (!key.startsWith(CHAT_IMAGES_PREFIX) || key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const message = await db.chatMessage.findFirst({
    where: { imageKey: key },
    select: { imageType: true, imageKey: true },
  });
  if (!message?.imageKey) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const buffer = await getObjectBuffer(message.imageKey);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": message.imageType ?? "image/png",
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}