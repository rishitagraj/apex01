import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeetingRoom } from "@/components/meeting-room";
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
    <div className="h-[calc(100vh-4rem)] min-h-0">
      <MeetingRoom
        code={code}
        roomName={code}
        hostId={meeting.host.id}
        userName={user?.name ?? "Studier"}
        meetingName={meeting.name}
      />
    </div>
  );
}