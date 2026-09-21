export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Current streak in days — consecutive days ending today (or yesterday, so an
 * unfinished today doesn't break the run) on which at least one revision or
 * study event was recorded.
 */
export function computeStreak(dateKeys: Iterable<string>): number {
  const set = new Set(dateKeys);
  const cursor = new Date();
  const today = toDateKey(cursor);

  if (!set.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(toDateKey(cursor))) return 0;
  }

  let streak = 0;
  while (set.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Distinct days with at least one event, as YYYY-MM-DD keys. */
export function distinctRevisionDays(
  dates: Iterable<{ revisedAt: Date } | Date> | Iterable<Date>,
): string[] {
  const out = new Set<string>();
  for (const entry of dates) {
    const d = entry instanceof Date ? entry : entry.revisedAt;
    out.add(toDateKey(d));
  }
  return [...out].sort();
}

/** True when a concept hasn't been revised inside the cutoff window. */
export function isRevisionDue(lastRevisedAt: Date | null, days = 7): boolean {
  if (!lastRevisedAt) return true;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return lastRevisedAt.getTime() < cutoff;
}