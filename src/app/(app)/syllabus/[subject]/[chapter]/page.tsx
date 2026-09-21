import { redirect, notFound } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { loadSyllabus } from "@/lib/syllabus";
import { ChapterFocus } from "@/components/syllabus/ChapterFocus";

export const dynamic = "force-dynamic";

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ subject: string; chapter: string }>;
}) {
  const { user } = await getAuthUser();
  if (!user) redirect("/login");

  const { subject: subjectId, chapter: chapterId } = await params;
  const tree = await loadSyllabus(user.id);

  const found = tree.subjects.some(
    (s) =>
      s.id === subjectId &&
      s.chapters.some((ch) => ch.id === chapterId),
  );
  if (!found) notFound();

  return (
    <ChapterFocus
      initialTree={tree}
      subjectId={subjectId}
      chapterId={chapterId}
    />
  );
}