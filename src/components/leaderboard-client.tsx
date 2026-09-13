"use client";

import { useEffect, useState } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { formatMinutes } from "@/components/ui";

type Entry = {
  rank: number;
  id: string;
  name: string;
  totalMinutes: number;
};

export function LeaderboardClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerMinutes, setViewerMinutes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.leaderboard ?? []);
        setViewerId(data.viewerId);
        setViewerMinutes(data.viewerMinutes ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  const medal = (rank: number) => {
    if (rank === 1) return "bg-amber-400/20 text-amber-300";
    if (rank === 2) return "bg-slate-300/15 text-slate-300";
    if (rank === 3) return "bg-orange-700/25 text-orange-300";
    return "text-muted";
  };

  const avg = topHalfAvg(entries);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric label="Your focus time" value={formatMinutes(viewerMinutes)} />
        <Metric label="Your rank" value={viewerRank(entries, viewerId)} />
        <Metric label="Top 10 average" value={formatMinutes(Math.round(avg))} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyLocal
          title="No focus time recorded yet"
          subtitle="Spend time in a focus room and it will count here automatically."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
            <span>Rank</span>
            <span>Studier</span>
            <span>Hours</span>
          </div>
          {entries.map((e) => {
            const isViewer = e.id === viewerId;
            return (
              <div
                key={e.id}
                className={`grid grid-cols-[3rem_1fr_auto] items-center gap-3 px-5 py-3 ${
                  isViewer ? "bg-apex/5" : ""
                } ${e.rank > 1 ? "border-t border-line" : ""}`}
              >
                <span className={`flex items-center gap-2 text-sm font-bold ${medal(e.rank)}`}>
                  {e.rank <= 3 ? <Trophy size={15} /> : null}
                  {e.rank}
                </span>
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-apex-gradient text-xs font-bold text-white">
                    {e.name?.charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="truncate text-sm font-medium">
                    {e.name}
                    {isViewer ? <span className="ml-2 text-xs text-apex">(you)</span> : null}
                  </span>
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {formatMinutes(e.totalMinutes)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gradient">{value}</p>
    </div>
  );
}

function EmptyLocal({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-16 text-center">
      <Trophy size={28} className="text-muted" />
      <p className="text-sm font-semibold">{title}</p>
      <p className="max-w-sm text-xs text-muted">{subtitle}</p>
    </div>
  );
}

function viewerRank(entries: Entry[], viewerId: string | null) {
  if (!viewerId) return "—";
  const found = entries.find((e) => e.id === viewerId);
  return found ? `#${found.rank}` : "100+";
}

function topHalfAvg(entries: Entry[]) {
  const top10 = entries.slice(0, 10);
  if (top10.length === 0) return 0;
  return top10.reduce((sum, e) => sum + e.totalMinutes, 0) / top10.length;
}