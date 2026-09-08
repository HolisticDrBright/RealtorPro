"use client";
import type { useJarvisSpeech } from "./jarvis-speech";
import { ErrorBox } from "@/components/ui/primitives";

export function JarvisVoiceSettings({ speech, beforePreview }: { speech: ReturnType<typeof useJarvisSpeech>; beforePreview: () => void }) {
  const choices = speech.voices.filter((voice) => !speech.preferences.localOnly || voice.localService);
  return <section className="mt-4 rounded-xl border border-line bg-ground p-4" aria-label="Jarvis voice settings">
    <div className="flex flex-wrap justify-between gap-2">
      <h3 className="font-semibold text-sm">Make Jarvis sound like Jarvis</h3>
      <span className="text-xs text-ink-3">Device voices · no extra API key</span>
    </div>
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px] mt-3">
      <div>
        <label htmlFor="jarvis-output-voice" className="label">Speaking voice</label>
        <select id="jarvis-output-voice" className="input" disabled={!speech.supported} value={speech.preferences.voiceURI} onChange={(e) => speech.configure({ voiceURI: e.target.value })}>
          <option value="">Automatic — prefer Enhanced / Premium / Natural</option>
          {speech.preferences.voiceURI && !choices.some((v) => v.voiceURI === speech.preferences.voiceURI) && <option value={speech.preferences.voiceURI}>Saved voice unavailable — choose another</option>}
          {choices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang} · {voice.localService ? "on device" : "online"}</option>)}
        </select>
        <p className="text-xs text-ink-3 mt-1">{speech.selected ? `Selected: ${speech.selected.name}` : "Waiting for an available voice. Try Refresh voices."}</p>
      </div>
      <div>
        <label htmlFor="jarvis-speech-rate" className="label">Speaking speed · {speech.preferences.rate.toFixed(2)}×</label>
        <input id="jarvis-speech-rate" type="range" className="w-full mt-2" min="0.75" max="1.2" step="0.01" value={speech.preferences.rate} onChange={(e) => speech.configure({ rate: Number(e.target.value) })} />
      </div>
    </div>
    <div className="flex flex-wrap gap-2 mt-3">
      <button type="button" className="btn btn-sm" disabled={!speech.supported} onClick={() => { beforePreview(); speech.speak("Hi, I'm Jarvis. Let's find your next best move. Which client or property would you like to review?"); }}>Preview voice</button>
      <button type="button" className="btn btn-sm" onClick={speech.stop}>Stop preview / audio</button>
      <button type="button" className="btn btn-sm" onClick={speech.refreshVoices}>Refresh voices</button>
    </div>
    <label className="flex items-start gap-2 text-xs mt-3"><input type="checkbox" checked={!speech.preferences.localOnly} onChange={(e) => speech.configure({ localOnly: !e.target.checked, voiceURI: "" })} />Allow online browser voices. Text read aloud may be sent to the voice provider; this can include private client or property details.</label>
    <p className="text-xs text-ink-3 mt-2">On a Mac, download an Enhanced or Premium voice in Accessibility’s Read & Speak (called Spoken Content on older macOS), then refresh this list. Only voices exposed by your browser appear here; Siri voices may not be available. <a className="link" href="https://support.apple.com/guide/mac-help/change-the-voice-your-mac-uses-to-speak-text-mchlp2290/mac" target="_blank" rel="noreferrer">Apple’s voice setup guide ↗</a></p>
    <p className="text-xs text-ink-3 mt-2">Voice and speed are remembered in this browser. The face reacts to speech activity and word timing where supported; mouth movement is expressive, not exact lip-sync. Spoken answers are AI-generated.</p>
    {!speech.supported && <p className="text-xs mt-2">Read-aloud is not supported here. Jarvis’s written answers still work.</p>}
    {speech.error && <ErrorBox message={speech.error} />}
  </section>;
}
