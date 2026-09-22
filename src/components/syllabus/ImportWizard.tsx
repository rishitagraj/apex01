"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileUp,
  FileText,
  Sparkles,
  Layers,
  Check,
  ChevronDown,
  Loader2,
  TriangleAlert,
  RotateCcw,
  Download,
  X,
  Import as ImportIcon,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { PromptBox } from "@/components/syllabus/PromptBox";
import { ImportPreview } from "@/components/syllabus/ImportPreview";
import { StorageCard } from "@/components/syllabus/StorageCard";
import { useImportWizard } from "@/hooks/useImportWizard";
import type { ImportRecordVM, StorageUsage } from "@/types/syllabus";

const STEPS = ["Upload", "AI Instructions", "Preview", "Done"] as const;

const ADVANCED: { key: keyof import("@/types/syllabus").ParseOptions; label: string; hint: string }[] = [
  { key: "detectPrerequisites", label: "Detect prerequisites", hint: "Map concept dependencies automatically" },
  { key: "estimateHours", label: "Estimate study hours", hint: "Conservative per-concept hour estimate" },
  { key: "generateRevisionSchedule", label: "Generate revision schedule", hint: "Revisions at days 2, 7, 14, 30" },
  { key: "generateChecklist", label: "Generate checklist", hint: "11-step learning checklist per concept" },
  { key: "mergeDuplicates", label: "Merge duplicates", hint: "Combine repeated chapters/concepts" },
  { key: "learningObjectives", label: "Extract learning objectives", hint: "Per-concept outcomes from the PDF" },
  { key: "dependencyGraph", label: "Generate dependency graph", hint: "Prerequisite-ordered knowledge graph" },
  { key: "keepPdf", label: "Keep PDF after parsing", hint: "Stores the source PDF in your quota" },
];

export function ImportWizard({
  recentImports,
  storage,
}: {
  recentImports: ImportRecordVM[];
  storage: StorageUsage;
}) {
  const wizard = useImportWizard();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const roadmap = wizard.roadmap;

  const readyToRun = wizard.file !== null;
  const stepIndex = wizard.step;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-gradient text-2xl font-extrabold tracking-tight sm:text-3xl">
          Import Syllabus
        </h1>
        <p className="mt-1 text-sm text-muted">
          Upload a syllabus PDF — Apex turns it into an interactive coverage roadmap.
        </p>
      </header>

      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                i < stepIndex + (stepIndex >= 3 ? 1 : 0)
                  ? "bg-apex-gradient text-white"
                  : i === stepIndex && stepIndex < 3
                    ? "ring-2 ring-apex text-apex"
                    : "border border-line text-muted"
              }`}
            >
              {i < stepIndex + (stepIndex >= 3 ? 1 : 0) ? <Check size={13} /> : i + 1}
            </span>
            <span
              className={`hidden text-xs sm:inline ${
                i <= stepIndex ? "font-medium text-foreground" : "text-muted"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 ? (
              <ChevronRight size={14} className="hidden text-muted sm:inline" />
            ) : null}
          </div>
        ))}
      </div>

      {wizard.error ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
          <p className="text-sm text-rose-300">{wizard.error}</p>
          {wizard.fileKey ? (
            <button className="btn" onClick={() => wizard.retry()}>
              <RotateCcw size={14} className="mr-1.5 inline" /> Retry without re-upload
            </button>
          ) : null}
        </div>
      ) : null}

      {wizard.needsOcr ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          The PDF looks like a scanned image — try a text-based PDF or a typed syllabus.
        </div>
      ) : null}

      {stepIndex === 0 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) wizard.chooseFile(f);
              }}
              className={`flex min-h-[240px] cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-8 text-center transition ${
                drag ? "border-apex bg-apex/10" : "border-line bg-surface/50 hover:border-apex/40"
              }`}
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-apex-gradient text-white shadow-xl shadow-apex/25">
                <FileUp size={28} />
              </span>
              <div>
                <p className="font-semibold">Drag & drop your syllabus PDF</p>
                <p className="mt-1 text-xs text-muted">
                  CBSE · Allen · FIITJEE · Resonance · JEE · NEET · Olympiad · University · Custom — up to 100 MB
                </p>
              </div>
              <button
                onClick={() => inputRef.current?.click()}
                className="btn"
              >
                <FolderOpen size={15} className="mr-1.5 inline" /> Browse files
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) wizard.chooseFile(f);
                }}
              />
            </label>

            {wizard.file ? (
              <div className="card flex items-center justify-between gap-3 rounded-2xl p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-apex/15 text-apex">
                    <FileText size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{wizard.file.name}</p>
                    <p className="text-xs text-muted">
                      {formatSize(wizard.file.size)} · PDF
                    </p>
                  </div>
                </div>
                <button onClick={() => wizard.setStep(1)} className="btn bg-apex-gradient text-white">
                  <Sparkles size={15} className="mr-1.5 inline" /> Configure & generate
                </button>
              </div>
            ) : null}

            <div className="card rounded-3xl p-5">
              <h2 className="mb-3 text-sm font-semibold">Recent imports</h2>
              {recentImports.length === 0 ? (
                <p className="text-xs text-muted">No imports yet.</p>
              ) : (
                <ul className="space-y-2">
                  {recentImports.map((imp) => (
                    <li
                      key={imp.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-black/20 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{imp.course}</p>
                        <p className="text-[11px] text-muted">
                          {imp.pdfName ?? "manual"} · {new Date(imp.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`chip ${
                            imp.status === "COMPLETED"
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                              : imp.status === "FAILED"
                                ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                                : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                          }`}
                        >
                          {imp.status.toLowerCase()}
                        </span>
                        <a
                          href="/api/syllabus/export?format=json"
                          className="rounded-lg p-1.5 text-muted hover:text-apex"
                          aria-label={`Download ${imp.course} JSON`}
                        >
                          <Download size={15} />
                        </a>
                        <button
                          onClick={async () => {
                            await fetch("/api/syllabus/delete", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ scope: "import", id: imp.id }),
                            });
                            router.refresh();
                          }}
                          className="rounded-lg p-1.5 text-muted hover:text-rose-400"
                          aria-label="Delete import"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <StorageCard usage={storage} />
            <div className="card rounded-3xl p-5">
              <h2 className="mb-2 text-sm font-semibold">What happens next</h2>
              <ol className="space-y-2 text-xs text-muted">
                <li>1. PDF is uploaded to secure storage (deleted after import)</li>
                <li>2. Text is extracted from every page</li>
                <li>3. Groq AI builds a structured roadmap</li>
                <li>4. You preview, edit & confirm before it lands in Apex</li>
              </ol>
            </div>
          </div>
        </div>
      ) : null}

      {stepIndex === 1 ? (
        <div className="card space-y-5 rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-apex/15 text-apex">
              <FileText size={18} />
            </span>
            <div>
              <p className="text-sm font-medium">Configure your roadmap</p>
              <p className="text-xs text-muted">{wizard.file?.name}</p>
            </div>
          </div>

          <PromptBox value={wizard.prompt} onChange={wizard.setPrompt} />

          <button
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground"
          >
            Advanced options
            <ChevronDown size={14} className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          </button>

          {showAdvanced ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {ADVANCED.map((opt) => (
                <label
                  key={opt.key}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-black/20 px-3 py-2.5 transition hover:border-apex/30"
                >
                  <input
                    type="checkbox"
                    checked={wizard.options[opt.key] as boolean}
                    onChange={(e) =>
                      wizard.setOptions({ ...wizard.options, [opt.key]: e.target.checked })
                    }
                    className="h-4 w-4 accent-[#ff7a1a]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{opt.label}</span>
                    <span className="block text-[11px] text-muted">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              onClick={() => wizard.uploadAndParse()}
              disabled={!readyToRun || wizard.parsing}
              className="btn bg-apex-gradient px-5 text-white shadow-lg shadow-apex/25 hover:opacity-90 disabled:opacity-50"
            >
              {wizard.parsing ? (
                <>
                  <Loader2 size={15} className="mr-1.5 inline animate-spin" />
                  <span className="max-w-[220px] truncate">{wizard.progressText || "Generating roadmap…"}</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} className="mr-1.5 inline" /> Generate Roadmap
                </>
              )}
            </button>
            <button onClick={() => wizard.setStep(0)} className="btn">
              Back
            </button>
          </div>
        </div>
      ) : null}

      {stepIndex === 2 && roadmap ? (
        <div className="space-y-4">
          <div className="card rounded-3xl p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">{roadmap.course}</h2>
                <p className="text-xs text-muted">Preview below — remove, rename or merge before importing.</p>
              </div>
              {roadmap.warnings.length > 0 ? (
                <span className="chip border-amber-500/40 bg-amber-500/10 text-amber-300">
                  <TriangleAlert size={12} className="mr-1 inline" /> {roadmap.warnings.length} warnings
                </span>
              ) : null}
            </div>
            {roadmap.warnings.length > 0 ? (
              <ul className="mb-3 space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                {roadmap.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            ) : null}
            {roadmap.userInstructionsApplied?.length ? (
              <p className="mb-3 text-[11px] text-muted">
                Instructions applied: {roadmap.userInstructionsApplied.join(" · ")}
              </p>
            ) : null}
            {wizard.textPreview ? (
              <details className="mb-3">
                <summary className="cursor-pointer text-[11px] text-muted hover:text-foreground">
                  Extracted text preview
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded-xl border border-line bg-black/20 p-3 text-[11px] leading-relaxed text-muted">
                  {wizard.textPreview}
                </pre>
              </details>
            ) : null}
          </div>

          <ImportPreview roadmap={roadmap} onChange={wizard.setRoadmap} />

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => wizard.confirmImport()}
              disabled={wizard.importing}
              className="btn bg-apex-gradient px-5 text-white shadow-lg shadow-apex/25 hover:opacity-90 disabled:opacity-50"
            >
              {wizard.importing ? (
                <Loader2 size={15} className="mr-1.5 inline animate-spin" />
              ) : (
                <ImportIcon size={15} className="mr-1.5 inline" />
              )}
              Import into Apex
            </button>
            <button onClick={() => wizard.setStep(1)} className="btn">
              Edit again
            </button>
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(roadmap, null, 2)], {
                  type: "application/json",
                });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${roadmap.course.toLowerCase().replace(/\s+/g, "-")}-roadmap.json`;
                a.click();
              }}
              className="btn"
            >
              <Download size={15} className="mr-1.5 inline" /> Download JSON
            </button>
            <button onClick={() => wizard.setStep(0)} className="btn">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {stepIndex === 3 && wizard.summary ? (
        <div className="card mx-auto max-w-xl rounded-3xl p-8 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <Check size={30} />
          </span>
          <h2 className="mt-4 text-xl font-bold">Roadmap imported</h2>
          <p className="mt-1 text-sm text-muted">{wizard.roadmap?.course ?? "Syllabus"} is now your coverage map.</p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              ["Subjects", wizard.summary.subjects],
              ["Chapters", wizard.summary.chapters],
              ["Concepts", wizard.summary.concepts],
              ["Dependency links", wizard.summary.dependencies],
              ["Revision events", wizard.summary.revisions],
              ["Resources", wizard.summary.resources],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-line bg-black/20 p-3">
                <p className="text-2xl font-extrabold tabular-nums text-apex">{value}</p>
                <p className="text-[11px] text-muted">{label}</p>
              </div>
            ))}
          </div>

          {wizard.roadmap?.warnings.length ? (
            <p className="mt-4 text-xs text-amber-300">
              {wizard.roadmap.warnings.join(" · ")}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/syllabus" className="btn bg-apex-gradient text-white">
              <Layers size={15} className="mr-1.5 inline" /> View coverage map
            </Link>
            <button
              onClick={() => {
                wizard.setStep(1);
                wizard.setSummary(null);
                wizard.setRoadmap(null);
              }}
              className="btn"
            >
              Import another
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}