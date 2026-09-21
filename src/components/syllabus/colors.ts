import type { SyllabusStatus } from "@/types/syllabus";

export const STATUS_LABEL: Record<SyllabusStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  NEEDS_REVISION: "Needs Revision",
  WEAK: "Weak",
  MASTERED: "Mastered",
};

export const STATUS_CHIP: Record<SyllabusStatus, string> = {
  NOT_STARTED: "border-line bg-surface text-muted",
  IN_PROGRESS: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  COMPLETED: "border-teal-500/40 bg-teal-500/10 text-teal-300",
  NEEDS_REVISION: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  WEAK: "border-purple-500/40 bg-purple-500/10 text-purple-300",
  MASTERED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};

export const STATUS_GLOW: Record<SyllabusStatus, string> = {
  NOT_STARTED: "",
  IN_PROGRESS: "",
  COMPLETED: "",
  NEEDS_REVISION: "shadow-[0_0_20px_-4px] shadow-amber-500/50",
  WEAK: "shadow-[0_0_20px_-4px] shadow-purple-500/50",
  MASTERED: "shadow-[0_0_20px_-4px] shadow-emerald-500/50",
};

export function difficultyClass(difficulty: string): string {
  const key = difficulty.toLowerCase();
  if (key.includes("easy")) {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }
  if (key.includes("hard") || key.includes("advanced") || key.includes("difficult")) {
    return "border-rose-500/40 bg-rose-500/10 text-rose-300";
  }
  return "border-amber-500/40 bg-amber-500/10 text-amber-300";
}

export const REVISION_LABEL: Record<string, string> = {
  REVISION_1: "Revision 1",
  REVISION_2: "Revision 2",
  REVISION_3: "Revision 3",
  REVISION_4: "Revision 4",
  MANUAL: "Manual revision",
};

export const RESOURCE_LABEL: Record<string, string> = {
  PDF: "PDF",
  IMAGE: "Image",
  MARKDOWN: "Notes",
  FORMULA: "Formula",
  DPP: "DPP",
  PYQ: "PYQ",
  LINK: "Link",
  YOUTUBE: "Video",
};