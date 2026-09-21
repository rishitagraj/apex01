"use client";

import { HardDrive, TriangleAlert, Trash2 } from "lucide-react";
import { formatBytes } from "@/utils/bytes";
import type { StorageUsage } from "@/types/syllabus";

export function StorageCard({ usage }: { usage: StorageUsage }) {
  const pct = usage.quotaBytes
    ? Math.min(100, Math.round((usage.usedBytes / usage.quotaBytes) * 100))
    : 0;
  const remaining = Math.max(0, usage.quotaBytes - usage.usedBytes);

  return (
    <div className="card rounded-3xl p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <HardDrive size={16} className="text-apex" />
        Storage
      </div>
      <p className="mt-1 text-[11px] text-muted">Free Plan · 2 GB</p>

      <div className="mt-3">
        <div className="flex items-end justify-between text-xs">
          <span className="font-medium tabular-nums">{formatBytes(usage.usedBytes)} used</span>
          <span className="text-muted">{formatBytes(remaining)} free</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              pct > 90 ? "bg-rose-500" : "bg-apex-gradient"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {usage.largest.length > 0 ? (
        <div className="mt-4">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted">Largest files</p>
          <ul className="space-y-1">
            {usage.largest.map((f) => (
              <li key={f.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-muted">{f.title || f.key}</span>
                <span className="shrink-0 tabular-nums text-muted">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-line bg-black/20 p-3">
        {usage.retainedPdfs > 0 ? (
          <p className="flex items-center gap-2 text-[11px] text-amber-300">
            <TriangleAlert size={12} className="shrink-0" />
            {usage.retainedPdfs} imported {usage.retainedPdfs === 1 ? "PDF" : "PDFs"} kept in storage.
          </p>
        ) : (
          <p className="flex items-center gap-2 text-[11px] text-muted">
            <Trash2 size={12} className="shrink-0" />
            Temporary syllabus PDFs are deleted after import.
          </p>
        )}
      </div>
    </div>
  );
}