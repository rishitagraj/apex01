import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeetingRoom } from "@/components/meeting-room";
import { CopyCodeButton } from "@/components/copy-code-button";
import { DeleteRoomButton } from "@/components/delete-room-button";
import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Focus room" };
export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const userId = await verifySession();
  if (!userId) notFound();

  const meeting = await db.meeting.findUnique({
    where: { code },
    include: { host: { select: { id: true, name: true } } },
  });
  if (!meeting) notFound();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{meeting.name}</h1>
          <p className="text-xs text-muted">
            Room {code} · hosted by {meeting.host.name}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {meeting.host.id === userId ? <DeleteRoomButton code={code} /> : null}
          <CopyCodeButton code={code} />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <MeetingRoom
          code={code}
          roomName={code}
          hostId={meeting.host.id}
          userName={user?.name ?? "Studier"}
        />
      </div>
    </div>
  );
}