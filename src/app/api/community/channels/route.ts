import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { chatChannelSchema } from "@/lib/validation";

const DEFAULT_CHANNELS = ["general", "study-help", "homework-help", "memes"];

async function ensureDefaultChannels() {
  const count = await db.chatChannel.count();
  if (count > 0) return;
  await db.chatChannel.createMany({
    data: DEFAULT_CHANNELS.map((name, i) => ({ name, sortOrder: i })),
  });
}

async function viewerIsAdmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });
  return user?.isAdmin === true;
}

export async function GET() {
  const userId = await verifySession();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDefaultChannels();

  const [channels, isAdmin] = await Promise.all([
    db.chatChannel.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, sortOrder: true },
    }),
    viewerIsAdmin(userId),
  ]);

  return NextResponse.json({ channels, isAdmin });
}

export async function POST(request: Request) {
  const userId = await verifySession();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await viewerIsAdmin(userId))) {
    return NextResponse.json(
      { error: "Only admins can create channels." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = chatChannelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existing = await db.chatChannel.findUnique({
    where: { name: parsed.data.name },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A channel with that name already exists." },
      { status: 409 },
    );
  }

  const latest = await db.chatChannel.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const channel = await db.chatChannel.create({
    data: { name: parsed.data.name, sortOrder: (latest?.sortOrder ?? 0) + 1 },
    select: { id: true, name: true, sortOrder: true },
  });

  return NextResponse.json({ channel }, { status: 201 });
}