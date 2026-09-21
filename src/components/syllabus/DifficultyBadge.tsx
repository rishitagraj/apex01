import { difficultyClass } from "@/components/syllabus/colors";

export function DifficultyBadge({
  difficulty,
  size = "sm",
}: {
  difficulty: string;
  size?: "sm" | "xs";
}) {
  return (
    <span
      className={`chip ${difficultyClass(difficulty)} ${
        size === "xs" ? "px-1.5 py-0 text-[10px]" : ""
      }`}
    >
      {difficulty}
    </span>
  );
}