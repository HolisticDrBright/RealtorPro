import { AppShell } from "@/components/app-shell";

/**
 * AgentOS is a single-window, local-first workspace. All six screens (Today,
 * Buyer Scout, Listing Studio, People & Deals, Follow Up Boss, Settings) are
 * rendered by <AppShell>, which switches the active screen from global client
 * state — mirroring the design prototype's architecture and preserving shared
 * state (shortlists, campaign review, dialogs) across screen changes.
 */
export default function Home() {
  return <AppShell />;
}
