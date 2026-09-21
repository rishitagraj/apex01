import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { loadSyllabus } from "@/lib/syllabus";
import { CoverageDashboard } from "@/components/syllabus/CoverageDashboard";

export const dynamic = "force-dynamic";

export default async function SyllabusPage() {
  const { user } = await getAuthUser();
  if (!user) redirect("/login");

  const tree = await loadSyllabus(user.id);
  return <CoverageDashboard initialTree={tree} />;
}