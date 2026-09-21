import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { loadSyllabus } from "@/lib/syllabus";
import { CoverageDashboard } from "@/components/syllabus/CoverageDashboard";

export const dynamic = "force-dynamic";

export default async function SyllabusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await getAuthUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const subject = typeof params.subject === "string" ? params.subject : undefined;
  const focus = typeof params.focus === "string" ? params.focus : undefined;

  const tree = await loadSyllabus(user.id);
  return (
    <CoverageDashboard
      initialTree={tree}
      initialSubjectId={subject}
      initialFocusId={focus}
    />
  );
}