import { redirect, notFound } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { loadSyllabus } from "@/lib/syllabus";
import { CoverageDashboard } from "@/components/syllabus/CoverageDashboard";

export const dynamic = "force-dynamic";

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { user } = await getAuthUser();
  if (!user) redirect("/login");

  const { subject } = await params;
  const tree = await loadSyllabus(user.id);

  const found = tree.subjects.some((s) => s.id === subject);
  if (!found) notFound();

  return <CoverageDashboard initialTree={tree} initialSubjectId={subject} />;
}