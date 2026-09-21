import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStorageUsage } from "@/lib/storage";
import { ImportWizard } from "@/components/syllabus/ImportWizard";
import { TemplateImporter } from "@/components/syllabus/TemplateImporter";
import type { ImportRecordVM } from "@/types/syllabus";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await getAuthUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const skip = params.skip === "1";

  const [imports, storage] = await Promise.all([
    db.syllabusImport.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, course: true, pdfName: true, status: true, createdAt: true },
    }),
    getStorageUsage(user.id),
  ]);

  const recentImports: ImportRecordVM[] = imports.map((r) => ({
    id: r.id,
    course: r.course,
    pdfName: r.pdfName,
    status: r.status,
    instructions: null,
    summary: null,
    createdAt: r.createdAt.toISOString(),
    completedAt: null,
  }));

  return (
    <div className="space-y-6">
      {skip ? <TemplateImporter onDone={() => undefined} /> : null}
      <ImportWizard recentImports={recentImports} storage={storage} />
    </div>
  );
}