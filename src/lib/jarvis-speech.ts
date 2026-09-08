export interface DeviceVoice { voiceURI: string; name: string; lang: string; localService: boolean; default: boolean }
export interface SpeechPreferences { voiceURI: string; rate: number; localOnly: boolean }
export const DEFAULT_SPEECH: SpeechPreferences = { voiceURI: "", rate: 0.96, localOnly: true };
export function speechPreferences(raw: unknown): SpeechPreferences {
  const r = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return { voiceURI: typeof r.voiceURI === "string" ? r.voiceURI.slice(0, 500) : "", rate: typeof r.rate === "number" && Number.isFinite(r.rate) ? Math.max(0.75, Math.min(1.2, r.rate)) : 0.96, localOnly: r.localOnly !== false };
}
export function preferredVoice<T extends DeviceVoice>(voices: T[], preferences: SpeechPreferences): T | undefined {
  const allowed = voices.filter((v) => !preferences.localOnly || v.localService);
  if (preferences.voiceURI) return allowed.find((v) => v.voiceURI === preferences.voiceURI);
  const score = (v: T) => (/^en([-_]|$)/i.test(v.lang) ? 1000 : 0) + (/premium/i.test(v.name) ? 100 : /enhanced/i.test(v.name) ? 90 : /natural|neural/i.test(v.name) ? 80 : 0) + (v.localService ? 10 : 0) + (v.default ? 5 : 0);
  return [...allowed].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))[0];
}
/** Remove visual markup, but preserve facts, names, amounts and punctuation. */
export function speechChunks(input: string, limit = 260): string[] {
  const text = input.replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "link in the written answer")
    .replace(/[*_`#]+/g, "").replace(/^[ \t]*[-•][ \t]+/gm, "").replace(/\s+/g, " ").trim();
  const chunks: string[] = []; let rest = text;
  while (rest.length > limit) {
    const part = rest.slice(0, limit + 1);
    const ends = [...part.matchAll(/[.!?;]\s/g)]; let cut = ends.at(-1)?.index;
    if (cut === undefined || cut < 60) cut = part.lastIndexOf(" ");
    else cut += 1;
    if (cut < 1) { cut = limit; if (/[\uD800-\uDBFF]/.test(rest[cut - 1])) cut--; }
    chunks.push(rest.slice(0, cut).trim()); rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest); return chunks;
}
