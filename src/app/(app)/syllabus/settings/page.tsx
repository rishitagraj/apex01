import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SettingsForm } from "@/components/syllabus/SettingsForm";
import type { SyllabusSettings } from "@/types/syllabus";

export const dynamic = "force-dynamic";

export default async function SyllabusSettingsPage() {
  const { user } = await getAuthUser();
  if (!user) redirect("/login");

  const [settings, subjects] = await Promise.all([
    db.userSyllabusSettings.findUnique({
      where: { userId: user.id },
      select: { examTags: true, autoRevisionDays: true, weeklyTargetHours: true },
    }),
    db.subject.findMany({ where: { userId: user.id }, select: { id: true } }),
  ]);

  const initial: SyllabusSettings = {
    defaultExamTags: settings?.examTags ?? ["NCERT", "CBSE", "JEE Main", "NEET"],
    autoRevisionDays: settings?.autoRevisionDays ?? 7,
    weeklyTargetHours: settings?.weeklyTargetHours ?? 20,
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-gradient text-2xl font-extrabold tracking-tight sm:text-3xl">
          Syllabus settings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Control how new imports are tagged, scheduled and managed.
        </p>
      </header>
      <SettingsForm initial={initial} subjectIds={subjects.map((s) => s.id)} />
    </div>
  );
}