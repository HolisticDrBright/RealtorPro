export interface HologramPoint { x: number; y: number; z: number; size: number; glow: number; warm: boolean; mouth: number; phase: number }
const g = (x: number, y: number, cx: number, cy: number, sx: number, sy: number) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2) * 2);
export function headWidth(y: number) {
  const n = (y + 0.25) / 1.12;
  return 0.72 * Math.sqrt(Math.max(0, 1 - n * n)) * (y > 0.1 ? 1 - (y - 0.1) * 0.2 : 1);
}
function faceDepth(x: number, y: number) {
  const w = headWidth(y);
  let z = 0.49 * Math.sqrt(Math.max(0, 1 - (x / (w || 1)) ** 2)) * Math.sqrt(Math.max(0, 1 - ((y + 0.25) / 1.12) ** 2));
  z += 0.15 * g(x, y, 0, -0.31, 0.1, 0.32); // bridge
  z += 0.30 * g(x, y, 0, -0.06, 0.12, 0.15); // nose tip
  z += 0.09 * g(x, y, -0.1, -0.01, 0.09, 0.07) + 0.09 * g(x, y, 0.1, -0.01, 0.09, 0.07);
  for (const side of [-1, 1]) {
    z -= 0.12 * g(x, y, side * 0.27, -0.4, 0.19, 0.115); // sockets
    z += 0.065 * g(x, y, side * 0.28, -0.55, 0.22, 0.055); // brow
    z += 0.06 * g(x, y, side * 0.4, -0.11, 0.2, 0.18); // cheekbones
  }
  z += 0.04 * g(x, y, 0, 0.23, 0.29, 0.10);
  z += 0.035 * g(x, y, 0, 0.62, 0.30, 0.16); // chin
  return z;
}
/** Original procedural point cloud; no photo, camera, face tracking or remote model. */
export function hologramPoints(count = 7200): HologramPoint[] {
  let seed = 71421;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const points: HologramPoint[] = [];
  const point = (x: number, y: number, z: number, glow = 1, mouth = 0) => points.push({ x, y, z, size: 0.55 + random() * 0.9, glow, warm: x > 0.1 && random() < 0.64, mouth, phase: random() * Math.PI * 2 });
  for (let i = 0; i < count; i++) {
    const y = -1.36 + random() * 2.23, w = headWidth(y), x = (random() * 2 - 1) * w;
    const eyes = Math.min(((x - 0.27) / 0.135) ** 2 + ((y + 0.4) / 0.047) ** 2, ((x + 0.27) / 0.135) ** 2 + ((y + 0.4) / 0.047) ** 2);
    const mouthHole = (x / 0.225) ** 2 + ((y - 0.255) / 0.029) ** 2;
    if (eyes < 1 || mouthHole < 1) continue;
    const z = faceDepth(x, y);
    const feature = Math.abs(x) < 0.12 && y > -0.45 && y < 0.06 || eyes < 1.8 || mouthHole < 3;
    const nx = -(faceDepth(x + 0.015, y) - faceDepth(x - 0.015, y)) / 0.03;
    const ny = -(faceDepth(x, y + 0.015) - faceDepth(x, y - 0.015)) / 0.03;
    const lighting = Math.max(0, (-nx * 0.7 - ny * 0.35 + 0.65) / Math.hypot(nx, ny, 1));
    point(x, y, z + (random() - 0.5) * 0.012, (feature ? 0.7 : 0.22) + lighting * 0.85 + random() * 0.18, y > 0.255 ? Math.max(0, 1 - Math.abs(x) / 0.38) * Math.max(0, 1 - (y - 0.255) / 0.5) : 0);
  }
  // Eye rims, eyelids and lips keep the expression readable at small sizes.
  for (const side of [-1, 1]) for (let i = 0; i < 100; i++) {
    const a = i / 100 * Math.PI * 2, x = side * 0.27 + Math.cos(a) * 0.137, y = -0.4 + Math.sin(a) * Math.abs(Math.sin(a)) * 0.044 + (random() - 0.5) * 0.01;
    point(x, y, faceDepth(x, y) + 0.018, 0.8 + random() * 0.3);
    if (i < 40) {
      const radius = Math.sqrt(random()) * 0.029, angle = random() * Math.PI * 2;
      point(side * 0.27 + Math.cos(angle) * radius, -0.4 + Math.sin(angle) * radius, faceDepth(side * 0.27, -0.4), 0.75);
    }
  }
  for (let i = 0; i < 140; i++) {
    const a = i / 140 * Math.PI * 2, x = Math.cos(a) * 0.232, y = 0.255 + Math.sin(a) * 0.030 + (random() - 0.5) * 0.012;
    point(x, y, faceDepth(x, y) + 0.02, 0.85 + random() * 0.3, Math.sin(a) > 0 ? Math.sin(a) : Math.sin(a) * 0.22);
  }
  for (const side of [-1, 1]) for (let i = 0; i < 160; i++) {
    const a = random() * Math.PI * 2, radius = Math.sqrt(random());
    point(side * (0.66 + Math.cos(a) * radius * 0.085), -0.18 + Math.sin(a) * radius * 0.23, 0.02 + random() * 0.04, 0.5 + random() * 0.4);
  }
  // Neck and a gently sloped shoulder silhouette.
  for (let i = 0; i < count * 0.2; i++) {
    const y = 0.65 + random() * 0.65, a = random() * Math.PI * 2;
    point(Math.sin(a) * (0.255 + (y - 0.65) * 0.10), y, Math.cos(a) * 0.28 - 0.03, 0.55);
  }
  for (let i = 0; i < count * 0.38; i++) {
    const x = (random() * 2 - 1) * 1.30, y = 1.14 + Math.abs(x) * 0.26 + random() * 0.35;
    point(x, y, Math.sqrt(Math.max(0, 1 - (x / 1.4) ** 2)) * 0.34 - random() * 0.38, 0.45 + random() * 0.4);
  }
  // A broader, shorter head reads as human rather than an elongated mask.
  return points.map((p) => ({ ...p, x: p.x * (p.y < 0.9 ? 1.12 : 1), y: p.y * 0.87 })).sort((a, b) => a.z - b.z);
}
