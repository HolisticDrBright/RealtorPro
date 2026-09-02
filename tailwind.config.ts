import type { Config } from "tailwindcss";

/** Luxury-minimal palette: off-white ground, charcoal ink, hairline borders, one gold accent. */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "#F7F7F5",
        panel: "#FFFFFF",
        ink: { DEFAULT: "#18181B", 2: "#52525B", 3: "#8A8A93" },
        line: { DEFAULT: "#E7E7E4", 2: "#F0F0EE" },
        gold: { DEFAULT: "#B8962E", soft: "#F6EFD9", ink: "#7A6119" },
        ok: { DEFAULT: "#1F8A5B", soft: "#E3F3EA" },
        warn: { DEFAULT: "#B7791F", soft: "#FBF0DC" },
        crit: { DEFAULT: "#C0392B", soft: "#FBE5E2" },
        info: { DEFAULT: "#2F5FBE", soft: "#E4EBF9" },
      },
      fontFamily: { sans: ["Instrument Sans", "Inter", "SF Pro Text", "system-ui", "sans-serif"] },
      borderRadius: { card: "14px" },
      boxShadow: { card: "0 1px 2px rgba(24,24,27,0.04)", pop: "0 12px 40px rgba(24,24,27,0.12)" },
    },
  },
  plugins: [],
};
export default config;
