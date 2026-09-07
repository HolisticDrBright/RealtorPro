export function normalizeLayout(saved: unknown, defaults: string[]): string[] {
  const ids = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string" && defaults.includes(id)) : [];
  return [...new Set([...ids, ...defaults])];
}
export function swapLayout(ids: string[], from: string, to: string): string[] {
  const a = ids.indexOf(from), b = ids.indexOf(to);
  if (a < 0 || b < 0 || a === b) return ids;
  const next = [...ids]; [next[a], next[b]] = [next[b], next[a]]; return next;
}
