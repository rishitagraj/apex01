import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import {
  CHAT_IMAGES_PREFIX,
  listObjectsSize,
  newChatImageKey,
  presignUpload,
} from "@/lib/b2";
import { chatImageSchema } from "@/lib/validation";

const CHAT_IMAGE_LIMIT_BYTES = 500 * 1024 * 1024;

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
  const parsed = chatImageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const used = await listObjectsSize(CHAT_IMAGES_PREFIX);
    if (used + parsed.data.fileSize > CHAT_IMAGE_LIMIT_BYTES) {
      return NextResponse.json(
        {
          error:
            "Community chat image storage is full (500 MB cap). Delete older images first.",
          code: "QUOTA_EXCEEDED",
        },
        { status: 409 },
      );
    }

    const imageKey = newChatImageKey(parsed.data.fileName);
    const uploadUrl = await presignUpload(
      imageKey,
      parsed.data.contentType,
      parsed.data.fileSize,
    );
    return NextResponse.json({
      ok: true,
      uploadUrl,
      imageKey,
      imageType: parsed.data.contentType,
    });
  } catch (err) {
    const code = (err as { code?: string }).code ?? "STORAGE_ERROR";
    if (code === "NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "Image storage is not configured.", code },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: String((err as Error)?.message ?? err), code },
      { status: 500 },
    );
  }
}