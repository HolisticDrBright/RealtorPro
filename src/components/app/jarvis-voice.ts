"use client";
import { useEffect, useRef, useState } from "react";

interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
export function useJarvisVoice(onTranscript: (text: string) => void) {
  const [supported, setSupported] = useState(false), [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callback = useRef(onTranscript);
  useEffect(() => { callback.current = onTranscript; }, [onTranscript]);
  const stop = () => { const active = recognition.current; recognition.current = null; if (active) { active.onresult = null; active.onerror = null; active.onend = null; active.abort(); } if (timer.current) clearTimeout(timer.current); setListening(false); };
  useEffect(() => {
    const w = window as SpeechWindow;
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    const hide = () => { if (document.hidden) { stop(); window.speechSynthesis?.cancel(); } };
    document.addEventListener("visibilitychange", hide);
    return () => { if (recognition.current) { recognition.current.onresult = null; recognition.current.onerror = null; recognition.current.onend = null; recognition.current.abort(); } if (timer.current) clearTimeout(timer.current); window.speechSynthesis?.cancel(); document.removeEventListener("visibilitychange", hide); };
  }, []);
  function start() {
    if (recognition.current) return;
    const w = window as SpeechWindow, Constructor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Constructor) { setError("Voice input is unavailable in this browser. Type your question or use your Mac's dictation in the text box."); return; }
    window.speechSynthesis?.cancel(); setError(null);
    const r = new Constructor(); recognition.current = r;
    let delivered = false;
    r.lang = "en-US"; r.continuous = false; r.interimResults = false;
    r.onresult = (event) => {
      const text = Array.from(event.results).filter((result) => result.isFinal).map((result) => result[0].transcript).join(" ").trim();
      if (text && !delivered) { delivered = true; callback.current(text.slice(0, 4000)); }
    };
    r.onerror = ({ error }) => { if (error === "aborted") return; setError(error === "not-allowed" || error === "service-not-allowed" ? "Microphone or speech permission was denied. Allow access in the browser, or type instead." : error === "no-speech" ? "No speech was detected. Try again or type your question." : "Voice recognition stopped or is unavailable. Check your microphone/network, or type instead."); };
    r.onend = () => { if (recognition.current !== r) return; recognition.current = null; if (timer.current) clearTimeout(timer.current); setListening(false); };
    try { r.start(); setListening(true); timer.current = setTimeout(() => r.stop(), 60000); }
    catch { recognition.current = null; setListening(false); setError("Could not start the microphone. Type your question instead."); }
  }
  return { supported, listening, error, start, stop };
}

export function speakJarvis(text: string) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const localVoice = window.speechSynthesis.getVoices().find((voice) => voice.localService && voice.lang.startsWith("en"));
  if (localVoice) utterance.voice = localVoice;
  utterance.lang = "en-US"; utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
  return true;
}
