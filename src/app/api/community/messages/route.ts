import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { chatMessageSchema } from "@/lib/validation";

const PAGE_SIZE = 60;

export async function GET(request: Request) {
  const userId = await verifySession();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channel") ?? "";
  const before = searchParams.get("before") ?? undefined;

  const channel = await db.chatChannel.findUnique({
    where: { id: channelId },
    select: { id: true },
  });
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const messages = await db.chatMessage.findMany({
    where: { channelId },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    ...(before ? { cursor: { id: before }, skip: 1 } : {}),
    select: {
      id: true,
      channelId: true,
      userId: true,
      authorName: true,
      content: true,
      imageKey: true,
      imageType: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    messages: messages.reverse(),
    viewerId: userId,
    oldestId: messages.length > 0 ? messages[messages.length - 1].id : null,
  });
}

export async function POST(request: Request) {
  const userId = await verifySession();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const channel = await db.chatChannel.findUnique({
    where: { id: parsed.data.channelId },
    select: { id: true },
  });
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const message = await db.chatMessage.create({
    data: {
      channelId: parsed.data.channelId,
      userId: user.id,
      authorName: user.name,
      content: (parsed.data.content ?? "").trim() || "",
      imageKey: parsed.data.imageKey ?? null,
      imageType: parsed.data.imageType ?? null,
    },
    select: {
      id: true,
      channelId: true,
      userId: true,
      authorName: true,
      content: true,
      imageKey: true,
      imageType: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ message }, { status: 201 });
}