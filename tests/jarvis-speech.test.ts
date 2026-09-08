import { describe, expect, it } from "vitest";
import { DEFAULT_SPEECH, preferredVoice, speechChunks, speechPreferences, type DeviceVoice } from "../src/lib/jarvis-speech";
import { headWidth, hologramPoints } from "../src/lib/jarvis-hologram";
const voices: DeviceVoice[] = [
  { voiceURI: "basic", name: "Basic", lang: "en-US", default: true, localService: true },
  { voiceURI: "enhanced", name: "Samantha Enhanced", lang: "en-US", default: false, localService: true },
  { voiceURI: "online", name: "Online Premium", lang: "en-US", default: false, localService: false },
  { voiceURI: "french", name: "French Premium", lang: "fr-FR", default: false, localService: true },
];
describe("Jarvis device speech", () => {
  it("prefers enhanced English device voices without selecting an online service", () => {
    expect(preferredVoice(voices, DEFAULT_SPEECH)?.voiceURI).toBe("enhanced");
    expect(preferredVoice([voices[2]], DEFAULT_SPEECH)).toBeUndefined();
    expect(preferredVoice(voices, { ...DEFAULT_SPEECH, localOnly: false })?.voiceURI).toBe("online");
  });
  it("honors an explicit selection and never silently substitutes a missing or forbidden voice", () => {
    expect(preferredVoice(voices, { ...DEFAULT_SPEECH, voiceURI: "basic" })?.voiceURI).toBe("basic");
    expect(preferredVoice(voices, { ...DEFAULT_SPEECH, voiceURI: "online" })).toBeUndefined();
    expect(preferredVoice(voices, { ...DEFAULT_SPEECH, voiceURI: "missing" })).toBeUndefined();
    expect(preferredVoice([], DEFAULT_SPEECH)).toBeUndefined();
  });
  it("validates stored preferences with privacy-safe defaults", () => {
    expect(speechPreferences(null)).toEqual(DEFAULT_SPEECH);
    expect(speechPreferences({ rate: Infinity, localOnly: "false", voiceURI: 3 })).toEqual(DEFAULT_SPEECH);
    expect(speechPreferences({ rate: 8, localOnly: false, voiceURI: "x" })).toEqual({ rate: 1.2, localOnly: false, voiceURI: "x" });
    expect(speechPreferences({ rate: 0 }).rate).toBe(0.75);
  });
  it("cleans display markup but retains meaningful names, prices and facts", () => {
    expect(speechChunks("## Match\n- **Sarah**: $1,250,000. [Property](https://example.com/123)")).toEqual(["Match Sarah: $1,250,000. Property"]);
    expect(speechChunks("See https://example.com")).toEqual(["See link in the written answer"]);
    expect(speechChunks("  ")).toEqual([]);
  });
  it("chunks long answers without losing text or exceeding the voice limit", () => {
    const text = "Sarah wants three bedrooms. Budget is $900,000. ".repeat(60).trim();
    const chunks = speechChunks(text);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((c) => c.length <= 260)).toBe(true);
    expect(chunks.join(" ")).toBe(text);
    const emoji = "😀".repeat(400);
    expect(speechChunks(emoji).join("")).toBe(emoji);
    expect(speechChunks(emoji).every((c) => !/[\uD800-\uDBFF]$/.test(c))).toBe(true);
  });
});
describe("Jarvis original hologram", () => {
  it("creates deterministic bounded points without downloading assets", () => {
    const points = hologramPoints(1000);
    expect(points).toEqual(hologramPoints(1000));
    expect(points.length).toBeGreaterThan(1000);
    expect(points.every((p) => [p.x, p.y, p.z, p.size, p.glow, p.mouth].every(Number.isFinite))).toBe(true);
    expect(points.every((p) => Math.abs(p.x) < 1.5 && Math.abs(p.y) < 2 && Math.abs(p.z) < 1)).toBe(true);
    expect(points.some((p) => p.warm)).toBe(true);
    expect(points.some((p) => p.mouth > 0)).toBe(true);
  });
  it("tapers the head at both ends", () => {
    expect(headWidth(-1.37)).toBeCloseTo(0);
    expect(headWidth(0.87)).toBeCloseTo(0);
    expect(headWidth(-0.25)).toBeGreaterThan(headWidth(0.7));
  });
});
