"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { hologramPoints } from "@/lib/jarvis-hologram";
import styles from "./jarvis-hologram.module.css";
export type HologramState = "idle" | "listening" | "thinking" | "speaking";
const labels: Record<HologramState, string> = { idle: "Ready when you are", listening: "Listening to you", thinking: "Working on your request", speaking: "Speaking" };
export function JarvisHologram({ state, pulse, children }: { state: HologramState; pulse: RefObject<number>; children?: React.ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null), current = useRef(state);
  const [animate, setAnimate] = useState(true), [available, setAvailable] = useState(true);
  useEffect(() => { current.current = state; }, [state]);
  useEffect(() => { try { setAnimate(localStorage.getItem("jarvis-hologram-motion") !== "off"); } catch { /* use default */ } }, []);
  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext("2d"); if (!element || !ctx) { setAvailable(false); return; }
    const points = hologramPoints(window.innerWidth < 600 ? 4500 : 7200), motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 600, height = 420, frame = 0, previous = 0, visible = true;
    function draw(now: number) {
      frame = 0;
      if (document.hidden || !visible) return;
      if (now - previous < 33 && animate && !motion.matches) { frame = requestAnimationFrame(draw); return; }
      previous = now;
      const moving = animate && !motion.matches, t = moving ? now / 1000 : 0, mode = current.current;
      const speaking = mode === "speaking" && moving;
      // Browser TTS exposes word boundaries, not visemes or an audio waveform.
      // This is a speech-state animation with boundary accents, not exact lip-sync.
      const accent = speaking ? Math.max(0, 1 - (now - pulse.current) / 240) : 0;
      const mouth = speaking ? (0.018 + 0.065 * Math.abs(Math.sin(t * 10.3)) * (0.55 + 0.45 * Math.sin(t * 3.7) ** 2) + accent * 0.025) : 0;
      ctx!.clearRect(0, 0, width, height);
      const halo = ctx!.createRadialGradient(width * 0.48, height * 0.43, 10, width * 0.5, height * 0.5, height * 0.66);
      halo.addColorStop(0, "rgba(27, 117, 144, .20)"); halo.addColorStop(0.7, "rgba(8, 35, 58, .1)"); halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = halo; ctx!.fillRect(0, 0, width, height);
      const scale = Math.min(height / 3.35, width / 3.55), yaw = -0.38 + Math.sin(t * 0.30) * 0.055;
      const cy = height * 0.43, cx = width * 0.50, breath = Math.sin(t * 1.3) * 0.012;
      ctx!.strokeStyle = mode === "listening" ? "rgba(109,240,230,.40)" : "rgba(75,154,189,.18)";
      ctx!.lineWidth = 1;
      for (let r = 0; r < 3; r++) {
        ctx!.beginPath(); ctx!.ellipse(cx, height * 0.88, scale * (1.26 + r * 0.17), scale * (0.20 + r * 0.06), 0, 0, Math.PI * 2); ctx!.stroke();
      }
      // Sparse ambient sparks, never derived from microphone or camera data.
      for (let i = 0; i < 65; i++) {
        const x = ((i * 97.3) % width), y = ((i * 53.7 - t * (3 + i % 4)) % height + height) % height;
        ctx!.fillStyle = i % 7 === 0 ? "rgba(247,190,104,.35)" : "rgba(88,215,242,.20)"; ctx!.fillRect(x, y, 1.2, 1.2);
      }
      for (const p of points) {
        const py = p.y + p.mouth * mouth + breath, px = p.x * Math.cos(yaw) + p.z * Math.sin(yaw);
        const depth = p.z * Math.cos(yaw) - p.x * Math.sin(yaw), perspective = 3.8 / (3.8 - depth);
        const x = cx + px * scale * perspective, y = cy + py * scale * perspective;
        const scan = mode === "thinking" ? Math.max(0, 1 - Math.abs(((t * 0.7) % 3.4 - 1.5) - p.y) / 0.12) : 0;
        const alpha = Math.min(0.98, (0.36 + depth * 0.62) * p.glow + Math.sin(t * 1.6 + p.phase) * 0.09 + scan * 0.4);
        const radius = p.size * (scale / 130) * perspective * (1 + accent * 0.15);
        ctx!.fillStyle = p.warm ? `rgba(255,201,126,${alpha * 0.92})` : `rgba(90,232,245,${alpha})`;
        ctx!.beginPath(); ctx!.arc(x, y, radius, 0, Math.PI * 2); ctx!.fill();
        if (p.glow > 1.2) { ctx!.fillStyle = `rgba(187,255,253,${alpha * 0.35})`; ctx!.fillRect(x - 0.6, y - 0.6, 1.2, 1.2); }
      }
      if (moving) frame = requestAnimationFrame(draw);
    }
    const redraw = () => { if (frame) cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
    const resize = () => {
      const rect = element!.getBoundingClientRect(); width = rect.width; height = rect.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      element!.width = Math.round(width * ratio); element!.height = Math.round(height * ratio); ctx!.setTransform(ratio, 0, 0, ratio, 0, 0); redraw();
    };
    const observer = new ResizeObserver(resize); observer.observe(element);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; redraw(); }); intersection.observe(element);
    motion.addEventListener("change", redraw); document.addEventListener("visibilitychange", redraw); resize();
    return () => { if (frame) cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect(); motion.removeEventListener("change", redraw); document.removeEventListener("visibilitychange", redraw); };
  }, [animate, pulse]);
  return <section className={styles.stage} aria-label="Jarvis holographic assistant" data-state={state}>
    <div className={styles.topline}><span><i /> JARVIS / VOICE INTERFACE</span><button onClick={() => { setAnimate(!animate); try { localStorage.setItem("jarvis-hologram-motion", animate ? "off" : "on"); } catch { /* optional */ } }}>{animate ? "Pause motion" : "Resume motion"}</button></div>
    <div className={styles.layout}>
      <div className={styles.portrait}><canvas ref={canvas} className={styles.canvas} aria-hidden="true" />{!available && <div className={styles.fallback}>J</div>}<div className={styles.scanlines} /></div>
      <div className={styles.copy}><span className={styles.eyebrow}>YOUR REAL ESTATE COPILOT</span><h2>A familiar face.<br />A clearer next step.</h2><p>Ask about your people, properties and plans.<br />Your approval stays in control.</p>
        <div className={styles.status} role="status"><span className={styles.dot} />{labels[state]}</div>
        <div className={styles.actions}>{children}</div>
        <p className={styles.caption}>Animated avatar · AI-generated answers<br />Microphone only activates when you press it.</p>
      </div>
    </div>
  </section>;
}
