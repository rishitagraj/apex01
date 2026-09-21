export type SyllabusStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NEEDS_REVISION"
  | "WEAK"
  | "MASTERED";

export const SYLLABUS_STATUSES: SyllabusStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "NEEDS_REVISION",
  "WEAK",
  "MASTERED",
];

export type ChecklistTask =
  | "READ_THEORY"
  | "WATCH_LECTURE"
  | "WRITE_NOTES"
  | "SOLVE_EXAMPLES"
  | "NCERT_EXERCISE"
  | "DPP"
  | "PYQ"
  | "REVISION_1"
  | "REVISION_2"
  | "REVISION_3"
  | "REVISION_4";

export const CHECKLIST_ORDER: { task: ChecklistTask; label: string }[] = [
  { task: "READ_THEORY", label: "Read theory" },
  { task: "WATCH_LECTURE", label: "Watch lecture" },
  { task: "WRITE_NOTES", label: "Write notes" },
  { task: "SOLVE_EXAMPLES", label: "Solve examples" },
  { task: "NCERT_EXERCISE", label: "Solve NCERT exercise" },
  { task: "DPP", label: "Solve DPP" },
  { task: "PYQ", label: "Solve PYQs" },
  { task: "REVISION_1", label: "Revision 1" },
  { task: "REVISION_2", label: "Revision 2" },
  { task: "REVISION_3", label: "Revision 3" },
  { task: "REVISION_4", label: "Revision 4" },
];

export type ResourceKind =
  | "PDF"
  | "IMAGE"
  | "MARKDOWN"
  | "FORMULA"
  | "DPP"
  | "PYQ"
  | "LINK"
  | "YOUTUBE";

export const RESOURCE_KINDS: ResourceKind[] = [
  "PDF",
  "IMAGE",
  "MARKDOWN",
  "FORMULA",
  "DPP",
  "PYQ",
  "LINK",
  "YOUTUBE",
];

export type RevisionKind =
  | "REVISION_1"
  | "REVISION_2"
  | "REVISION_3"
  | "REVISION_4"
  | "MANUAL";

export type Difficulty = "Easy" | "Medium" | "Hard";

export const EXAM_TAGS = [
  "NCERT",
  "CBSE",
  "Allen",
  "JEE Main",
  "JEE Advanced",
  "NEET",
  "Olympiad",
  "Visual",
  "Formula",
  "Proof",
  "Application",
] as const;

export interface ChecklistItemVM {
  id: string | null;
  task: ChecklistTask;
  label: string;
  weight: number;
  done: boolean;
}

export interface RevisionEventVM {
  id: string;
  kind: RevisionKind;
  note: string | null;
  revisedAt: string;
}

export interface ResourceVM {
  id: string;
  kind: ResourceKind;
  title: string;
  url: string | null;
  key: string | null;
  size: number;
  favourite: boolean;
  createdAt: string;
}

export interface ConceptVM {
  id: string;
  name: string;
  description: string | null;
  difficulty: string;
  status: SyllabusStatus;
  coverage: number;
  confidence: number;
  studyMinutes: number;
  lastRevisedAt: string | null;
  tags: string[];
  learningObjectives: string[];
  estimatedHours: number | null;
  resourceCount: number;
  mistakesCount: number;
  checklist: ChecklistItemVM[];
  checklistDone: number;
  checklistTotal: number;
  needsRevision: boolean;
  notes: string;
  revisions: RevisionEventVM[];
  resources: ResourceVM[];
  prerequisites: string[];
}

export interface ChapterVM {
  id: string;
  name: string;
  description: string | null;
  order: number;
  difficulty: string;
  estimatedHours: number | null;
  conceptCount: number;
  completedCount: number;
  coverage: number;
  revisionDue: number;
  resources: number;
  concepts: ConceptVM[];
}

export interface SubjectVM {
  id: string;
  name: string;
  classLevel: string | null;
  examTags: string[];
  order: number;
  chapters: ChapterVM[];
}

export interface DashboardStats {
  conceptsCompleted: number;
  totalConcepts: number;
  coverage: number;
  needsRevision: number;
  weakCount: number;
  masteredCount: number;
  streakDays: number;
  totalStudyMinutes: number;
}

export interface SyllabusTree {
  subjects: SubjectVM[];
  stats: DashboardStats;
}

export interface ImportSummary {
  subjects: number;
  chapters: number;
  concepts: number;
  dependencies: number;
  revisions: number;
  resources: number;
}

export type ExportFormat = "json" | "markdown" | "csv";

export interface ImportRecordVM {
  id: string;
  course: string;
  pdfName: string | null;
  status: "PENDING" | "PARSING" | "COMPLETED" | "FAILED";
  instructions: string | null;
  summary: ImportSummary | null;
  createdAt: string;
  completedAt: string | null;
}

export interface SyllabusSettings {
  defaultExamTags: string[];
  autoRevisionDays: number;
  weeklyTargetHours: number;
}

export interface ResourceDraft {
  kind: ResourceKind;
  title: string;
  url: string | null;
}

export interface ConceptDraft {
  name: string;
  description?: string | null;
  difficulty?: string;
  estimatedHours?: number | null;
  prerequisites?: string[];
  learningObjectives?: string[];
  tags?: string[];
  resources?: ResourceDraft[];
}

export interface ChapterDraft {
  name: string;
  description?: string | null;
  concepts: ConceptDraft[];
}

export interface SubjectDraft {
  name: string;
  classLevel?: string | null;
  examTags?: string[];
  chapters: ChapterDraft[];
}

export interface RoadmapDraft {
  course: string;
  subjects: SubjectDraft[];
  warnings: string[];
  userInstructionsApplied?: string[];
  revisionDays?: number[];
}

export interface ParseOptions {
  detectPrerequisites: boolean;
  estimateHours: boolean;
  generateRevisionSchedule: boolean;
  generateChecklist: boolean;
  mergeDuplicates: boolean;
  learningObjectives: boolean;
  dependencyGraph: boolean;
  keepPdf: boolean;
}

export const DEFAULT_PARSE_OPTIONS: ParseOptions = {
  detectPrerequisites: true,
  estimateHours: true,
  generateRevisionSchedule: true,
  generateChecklist: true,
  mergeDuplicates: true,
  learningObjectives: true,
  dependencyGraph: true,
  keepPdf: false,
};

export interface HeatmapCell {
  date: string;
  count: number;
}

export interface TimelinePoint {
  date: string;
  revisedCumulative: number;
  totalConcepts: number;
}

export interface Insights {
  heatmap: HeatmapCell[];
  timeline: TimelinePoint[];
}

export interface StorageUsage {
  usedBytes: number;
  quotaBytes: number;
  files: { key: string; title: string; size: number }[];
  largest: { key: string; title: string; size: number }[];
  retainedPdfs: number;
}