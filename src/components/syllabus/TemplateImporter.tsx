"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Check } from "lucide-react";
import { CBSE_TEMPLATE } from "@/utils/templates";
import { DEFAULT_PARSE_OPTIONS } from "@/types/syllabus";

export function TemplateImporter({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="card flex flex-col items-center gap-3 rounded-3xl p-6 text-center sm:flex-row sm:text-left">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-apex/15 text-apex">
        <Sparkles size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">No PDF handy? Start from the CBSE template</h3>
        <p className="text-xs text-muted">
          A ready-made CBSE Class 11 &amp; 12 roadmap (Mathematics, Physics, Chemistry) — instant, no AI needed.
        </p>
      </div>
      <button
        disabled={state !== "idle"}
        onClick={async () => {
          setState("busy");
          setError(null);
          try {
            const res = await fetch("/api/syllabus/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                roadmap: CBSE_TEMPLATE,
                course: CBSE_TEMPLATE.course,
                pdfName: null,
                fileKey: null,
                instructions: "Built-in CBSE template",
                options: { ...DEFAULT_PARSE_OPTIONS, keepPdf: false },
              }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Template import failed");
            setState("done");
            onDone();
            router.refresh();
            router.push("/syllabus");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Template import failed");
            setState("idle");
          }
        }}
        className="btn bg-apex-gradient px-4 text-white shadow-lg shadow-apex/25 hover:opacity-90 disabled:opacity-50"
      >
        {state === "idle" ? (
          <>
            <Sparkles size={15} className="mr-1.5 inline" /> Load template
          </>
        ) : state === "busy" ? (
          <Loader2 size={15} className="mr-1.5 inline animate-spin" />
        ) : (
          <>
            <Check size={15} className="mr-1.5 inline" /> Imported!
          </>
        )}
      </button>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}