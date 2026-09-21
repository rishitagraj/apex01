import "server-only";
import { db } from "@/lib/db";
import type { StorageUsage } from "@/types/syllabus";
export { formatBytes } from "@/utils/bytes";

const FREE_PLAN_QUOTA = 2 * 1024 * 1024 * 1024; // 2 GB

/**
 * Per-user storage usage over the `apex-storage` namespace. Files are tracked
 * by their R2 keys via concept resources + retained import PDFs.
 */
export async function getStorageUsage(userId: string): Promise<StorageUsage> {
  try {
    const [resources, retained] = await Promise.all([
      db.conceptResource.findMany({
        where: { userId, key: { not: null } },
        select: { key: true, title: true, size: true },
      }),
      db.syllabusImport.findMany({
        where: { userId, fileKey: { not: null } },
        select: { fileKey: true, pdfName: true },
      }),
    ]);

    const seen = new Set<string>();
    const files: { key: string; title: string; size: number }[] = [];
    for (const r of resources) {
      if (!r.key) continue;
      const key = r.key;
      if (seen.has(key)) continue;
      seen.add(key);
      files.push({ key, title: r.title, size: Math.max(0, r.size) });
    }
    const retainedPdfs = retained.length;

    const usedBytes = files.reduce((sum, f) => sum + f.size, 0);
    const largest = [...files].sort((a, b) => b.size - a.size).slice(0, 5);

    return {
      usedBytes,
      quotaBytes: FREE_PLAN_QUOTA,
      files,
      largest,
      retainedPdfs,
    };
  } catch {
    return {
      usedBytes: 0,
      quotaBytes: FREE_PLAN_QUOTA,
      files: [],
      largest: [],
      retainedPdfs: 0,
    };
  }
}