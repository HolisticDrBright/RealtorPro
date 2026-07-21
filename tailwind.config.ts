import type { Config } from "tailwindcss";

/**
 * Tailwind is part of the intended stack and is available for utility classes.
 * The Modernist design system itself is expressed as CSS custom properties and
 * component classes in `src/app/globals.css` (a direct port of the design
 * handoff's `design-system-tokens.css`), so the theme below simply exposes the
 * same tokens to Tailwind for convenience. Radius is 0 everywhere by design.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        ink: "var(--color-text)",
        accent: "var(--color-accent)",
        divider: "var(--color-divider)",
      },
      fontFamily: {
        heading: ["var(--font-body)"],
        body: ["var(--font-body)"],
      },
      borderRadius: {
        none: "0px",
        sm: "0px",
        DEFAULT: "0px",
        md: "0px",
        lg: "0px",
      },
    },
  },
  plugins: [],
};

export default config;
