export function nowISO() {
  return new Date().toISOString();
}

export function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// Aggregate duplicate timestamps by summing values (simple MVP rule)
export function aggregateByTs(points: { ts: string; value: number }[]) {
  const map = new Map<string, number>();
  for (const p of points) map.set(p.ts, (map.get(p.ts) ?? 0) + p.value);
  return [...map.entries()]
    .map(([ts, value]) => ({ ts, value }))
    .sort((a, b) => a.ts.localeCompare(b.ts));
}
