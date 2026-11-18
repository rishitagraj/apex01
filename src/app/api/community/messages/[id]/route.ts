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

  const message = await db.chatMessage.findUnique({
    where: { id },
    select: { userId: true, imageKey: true },
  });
  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const viewer = await db.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });
  const canDelete = message.userId === userId || viewer?.isAdmin === true;
  if (!canDelete) {
    return NextResponse.json(
      { error: "You can only delete your own messages." },
      { status: 403 },
    );
  }

  await db.chatMessage.delete({ where: { id } });

  if (message.imageKey?.startsWith(CHAT_IMAGES_PREFIX)) {
    await deleteObject(message.imageKey).catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
}