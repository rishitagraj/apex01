import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { CHAT_IMAGES_PREFIX, deleteObject } from "@/lib/b2";

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await verifySession();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });
  if (user?.isAdmin !== true) {
    return NextResponse.json(
      { error: "Only admins can delete channels." },
      { status: 403 },
    );
  }

  const channel = await db.chatChannel.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const images = await db.chatMessage.findMany({
    where: { channelId: id, imageKey: { not: null } },
    select: { imageKey: true },
  });
  for (const m of images) {
    if (m.imageKey?.startsWith(CHAT_IMAGES_PREFIX)) {
      await deleteObject(m.imageKey).catch(() => undefined);
    }
  }

  await db.chatChannel.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}