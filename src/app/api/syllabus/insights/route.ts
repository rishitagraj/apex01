import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Insights, TimelinePoint } from "@/types/syllabus";

export const runtime = "nodejs";

// Aggregates revision history for the GitHub-style heatmap (last ~16 weeks,
// Sun-Sat weeks) and a cumulative-coverage timeline for the line chart.
// Query param ?subject=<id> narrows both to a single subject.
export async function GET(req: Request) {
  const userId = await verifySession();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const subjectId = url.searchParams.get("subject");

  try {
    const since = new Date();
    since.setDate(since.getDate() - 365);

    const revisionWhere = subjectId
      ? {
          userId,
          revisedAt: { gte: since },
          concept: { chapter: { subjectId } },
        }
      : { userId, revisedAt: { gte: since } };

    const [revisions, totalConcept] = await Promise.all([
      db.conceptRevision.findMany({
        where: revisionWhere,
        select: { revisedAt: true },
      }),
      db.concept.count({
        where: subjectId
          ? { chapter: { subjectId } }
          : { chapter: { subject: { userId } } },
      }),
    ]);

    const byDay = new Map<string, number>();
    for (const r of revisions) {
      const key = r.revisedAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    const heatmap: { date: string; count: number }[] = [];
    const start = new Date();
    start.setDate(start.getDate() - (16 * 7 - 1));
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 16 * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      heatmap.push({
        date: d.toISOString().slice(0, 10),
        count: byDay.get(d.toISOString().slice(0, 10)) ?? 0,
      });
    }

    const timeline: TimelinePoint[] = [];
    const distinct = [...new Set(revisions.map((r) => r.revisedAt.toISOString().slice(0, 10)))].sort();
    let cumulative = 0;
    for (const day of distinct) {
      // cumulative = number of *distinct* concepts ever revised up to that day
      cumulative = revisions.filter((r) => r.revisedAt.toISOString().slice(0, 10) <= day).length;
      timeline.push({
        date: day,
        revisedCumulative: Math.min(cumulative, totalConcept),
        totalConcepts: totalConcept,
      });
    }

    const insights: Insights = { heatmap, timeline };
    return Response.json(insights);
  } catch (err) {
    console.error("syllabus/insights failed", err);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}