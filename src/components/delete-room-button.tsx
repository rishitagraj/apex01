"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

export function DeleteRoomButton({ code }: { code: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/meetings/${code}`, { method: "DELETE" });
      if (res.ok) {
        router.replace("/rooms");
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Could not delete the room.");
    } catch {
      setError("Could not delete the room.");
    } finally {
      setDeleting(false);
    }
  }

  if (!armed) {
    return (
      <button
        onClick={() => setArmed(true)}
        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-rose-500/40 hover:text-rose-400"
      >
        <Trash2 size={14} /> Delete room
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-1.5">
      <span className="text-xs text-rose-400">Delete this room?</span>
      <button
        onClick={remove}
        disabled={deleting}
        className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/90 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
      >
        {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        {deleting ? "Deleting…" : "Delete"}
      </button>
      <button
        onClick={() => setArmed(false)}
        disabled={deleting}
        className="rounded-md px-2 py-1 text-xs font-semibold text-muted transition hover:text-foreground"
      >
        Cancel
      </button>
      {error ? <span className="text-xs text-rose-400">{error}</span> : null}
    </div>
  );
}