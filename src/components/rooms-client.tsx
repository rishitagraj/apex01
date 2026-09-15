"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Video, Users, Crown, Plus, Loader2, Trash2, Shield } from "lucide-react";
import { Button, Card, Input, Label, EmptyState, formatMinutes } from "@/components/ui";

type Room = {
  id: string;
  name: string;
  code: string;
  hostName: string;
  createdAt: string;
  isHost: boolean;
  isJoined: boolean;
  participantCount: number;
  totalHours: number;
};

export function RoomsClient({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [joiningCode, setJoiningCode] = useState<string | null>(null);
  const [deleteArmedId, setDeleteArmedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/meetings").catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setRooms(data.rooms ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(refresh, 0);
    return () => clearTimeout(id);
  }, [refresh]);

  async function createRoom(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Give your room a name.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/rooms/${data.room.code}`);
        return;
      }
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Could not create the room. Try again.");
    } catch {
      setError("Could not create the room. Try again.");
    } finally {
      setCreating(false);
    }
  }

  async function join(room: Room) {
    setJoiningCode(room.code);
    try {
      await fetch(`/api/meetings/${room.code}/join`, { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error(`join failed (${r.status})`);
      });
    } catch {
      // Best effort
    } finally {
      setJoiningCode(null);
      router.push(`/rooms/${room.code}`);
    }
  }

  async function deleteRoom(room: Room) {
    setDeletingId(room.id);
    const res = await fetch(`/api/meetings/${room.code}`, { method: "DELETE" }).catch(() => null);
    setDeletingId(null);
    setDeleteArmedId(null);
    if (res?.ok) {
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
    } else {
      setError("Could not delete the room. You may have left the tab open — refresh to retry.");
    }
  }

  const canDelete = (room: Room) => isAdmin || room.isHost;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <form onSubmit={createRoom} className="space-y-4">
          <div>
            <Label htmlFor="room-name">Create a focus room</Label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                id="room-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Organic Chemistry 2AM grind"
              />
              <Button type="submit" disabled={creating} className="btn-primary shrink-0">
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Create room
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">{rooms.length}/5 rooms active</span>
            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          </div>
        </form>
      </Card>

      {isAdmin && rooms.length > 0 && (
        <AdminDeleteAll rooms={rooms} onDeleted={(ids) => setRooms((prev) => prev.filter((r) => !ids.includes(r.id)))} />
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-muted">Loading rooms…</p>
      ) : rooms.length === 0 ? (
        <EmptyState
          icon={<Video size={28} />}
          title="No rooms yet"
          subtitle="Create your first focus room and invite classmates in the app."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <Card key={room.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-apex-gradient shadow-lg shadow-apex/20">
                  <Video size={20} className="text-white" />
                </div>
                <div className="flex shrink-0 gap-2">
                  {isAdmin && !room.isHost ? (
                    <span className="chip border-purple-500/40 bg-purple-500/10 text-purple-400">
                      <Shield size={12} /> Admin
                    </span>
                  ) : null}
                  {room.isHost ? (
                    <span className="chip border-apex/40 bg-apex/10 text-apex">
                      <Crown size={12} /> Host
                    </span>
                  ) : null}
                </div>
              </div>

              <h3 className="mt-4 text-base font-semibold">{room.name}</h3>
              <p className="mt-1 font-mono text-xs text-muted">Room code: {room.code}</p>
              <p className="mt-1 text-xs text-muted">Hosted by {room.hostName}</p>

              <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Users size={14} /> {room.participantCount} live
                </span>
                <span>{formatMinutes(room.totalHours * 60)} studied</span>
              </div>

              <Button
                onClick={() => join(room)}
                disabled={joiningCode !== null}
                className="btn-primary mt-5 w-full"
              >
                {joiningCode === room.code ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Video size={16} />
                )}
                {joiningCode === room.code ? "Joining…" : "Join room"}
              </Button>

              {canDelete(room) ? (
                <div className="mt-2">
                  {deleteArmedId === room.id ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2">
                      <span className="text-xs text-rose-400">Delete this room?</span>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => deleteRoom(room)}
                          disabled={deletingId === room.id}
                          className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/90 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
                        >
                          {deletingId === room.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                          {deletingId === room.id ? "Deleting…" : "Delete"}
                        </button>
                        <button
                          onClick={() => setDeleteArmedId(null)}
                          disabled={deletingId === room.id}
                          className="rounded-md px-2 py-1 text-xs font-semibold text-muted transition hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteArmedId(room.id)}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-muted transition hover:border-rose-500/40 hover:text-rose-400"
                    >
                      <Trash2 size={13} /> Delete room
                    </button>
                  )}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminDeleteAll({
  rooms,
  onDeleted,
}: {
  rooms: Room[];
  onDeleted: (ids: string[]) => void;
}) {
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function deleteAll() {
    setDeleting(true);
    const ids: string[] = [];
    for (const room of rooms) {
      const res = await fetch(`/api/meetings/${room.code}`, { method: "DELETE" }).catch(() => null);
      if (res?.ok) ids.push(room.id);
    }
    setDeleting(false);
    setArmed(false);
    if (ids.length > 0) onDeleted(ids);
  }

  return (
    <Card className="border-purple-500/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Admin controls</p>
          <p className="text-xs text-muted">Delete all {rooms.length} active room{rooms.length !== 1 ? "s" : ""} at once.</p>
        </div>
        {armed ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={deleteAll}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
            >
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              {deleting ? "Deleting…" : "Confirm delete all"}
            </button>
            <button
              onClick={() => setArmed(false)}
              disabled={deleting}
              className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setArmed(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/10"
          >
            <Trash2 size={14} /> Delete all
          </button>
        )}
      </div>
    </Card>
  );
}