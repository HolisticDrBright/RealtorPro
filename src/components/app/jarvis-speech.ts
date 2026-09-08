"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SPEECH, preferredVoice, speechChunks, speechPreferences, type SpeechPreferences } from "@/lib/jarvis-speech";
const storageKey = "jarvis-speech-v1";
export function useJarvisSpeech() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [preferences, setPreferences] = useState<SpeechPreferences>(DEFAULT_SPEECH);
  const [supported, setSupported] = useState(false), [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null), generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), active = useRef(false);
  const pulse = useRef(0);
  const stop = useCallback(() => {
    generation.current++; active.current = false;
    if (timer.current) clearTimeout(timer.current);
    if (utterance.current) { utterance.current.onstart = null; utterance.current.onend = null; utterance.current.onerror = null; utterance.current.onboundary = null; }
    utterance.current = null; window.speechSynthesis?.cancel(); setSpeaking(false); pulse.current = 0;
  }, []);
  const refreshVoices = useCallback(() => { if ("speechSynthesis" in window) setVoices(window.speechSynthesis.getVoices()); }, []);
  useEffect(() => {
    const exists = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window; setSupported(exists);
    try { setPreferences(speechPreferences(JSON.parse(localStorage.getItem(storageKey) || "{}"))); } catch { /* safe defaults */ }
    if (!exists) return;
    refreshVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
    const later = setTimeout(refreshVoices, 1200);
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", hide);
    return () => { stop(); clearTimeout(later); window.speechSynthesis.removeEventListener?.("voiceschanged", refreshVoices); document.removeEventListener("visibilitychange", hide); };
  }, [refreshVoices, stop]);
  function configure(next: Partial<SpeechPreferences>) {
    stop(); const value = speechPreferences({ ...preferences, ...next }); setPreferences(value); setError(null);
    try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* usable without storage */ }
  }
  const speak = useCallback((text: string) => {
    stop(); setError(null);
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) { setError("Read-aloud is unavailable in this browser."); return false; }
    const available = window.speechSynthesis.getVoices(), selected = preferredVoice(available, preferences);
    if (!selected) { setError(preferences.voiceURI ? "Your selected voice is unavailable. Refresh voices or choose Automatic." : "No permitted device voice is available yet. Download a Mac voice, refresh voices, or explicitly allow browser online voices."); return false; }
    const chunks = speechChunks(text); if (!chunks.length) return false;
    const current = generation.current;
    function play(index: number) {
      if (generation.current !== current) return;
      if (index === chunks.length) { active.current = false; utterance.current = null; setSpeaking(false); return; }
      const u = new SpeechSynthesisUtterance(chunks[index]); utterance.current = u;
      u.voice = selected!; u.lang = selected!.lang; u.rate = preferences.rate; u.pitch = 1; u.volume = 1;
      u.onstart = () => { if (generation.current !== current) return; active.current = true; if (timer.current) clearTimeout(timer.current); setSpeaking(true); pulse.current = performance.now(); };
      u.onboundary = () => { if (generation.current === current) pulse.current = performance.now(); };
      u.onend = () => { if (generation.current !== current) return; if (timer.current) clearTimeout(timer.current); play(index + 1); };
      u.onerror = (e) => { if (generation.current !== current) return; stop(); if (!["canceled", "interrupted"].includes(e.error)) setError("The voice could not play. Try Preview voice, another installed voice, or check browser audio permissions."); };
      timer.current = setTimeout(() => { if (generation.current === current) { stop(); setError("Audio did not start. Click Preview voice to enable audio, or select another voice."); } }, 12000);
      try { window.speechSynthesis.speak(u); } catch { stop(); setError("Could not start this voice. Select another voice and try Preview."); }
    }
    play(0); return true;
  }, [preferences, stop]);
  // Some browsers do not emit onend after an external speechSynthesis.cancel().
  useEffect(() => {
    if (!speaking) return;
    const check = setInterval(() => { if (active.current && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) stop(); }, 500);
    return () => clearInterval(check);
  }, [speaking, stop]);
  return { voices, preferences, supported, speaking, error, pulse, speak, stop, configure, refreshVoices, selected: preferredVoice(voices, preferences) };
}
