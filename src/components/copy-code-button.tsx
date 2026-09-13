"use client";

import { Check } from "lucide-react";

export function CopyCodeButton({ code }: { code: string }) {
  return (
    <button
      onClick={async (e) => {
        await navigator.clipboard.writeText(
          `${typeof window !== "undefined" && window.location.origin}/rooms/${code}`,
        );
        const target = e.currentTarget;
        target.classList.add("text-emerald-400");
        setTimeout(() => target.classList.remove("text-emerald-400"), 1500);
      }}
      className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium transition hover:border-apex/40"
    >
      <Check size={14} /> Copy invite link
    </button>
  );
}