import { AppShell } from "@/components/app-shell";

/**
 * Dashboard-only build of AgentOS: one screen, fed by the same local API
 * (Follow Up Boss mirror, Claude briefing, Obsidian vault, read-only Google
 * calendar + inbox).
 */
export default function Home() {
  return <AppShell />;
}
