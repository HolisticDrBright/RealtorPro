"use client";

import { useApp, type Screen } from "./app-state";
import {
  IconDash,
  IconComp,
  IconFub,
  IconMic,
  IconOm,
  IconPeople,
  IconRent,
  IconScout,
  IconSettings,
  IconSignal,
  IconStudio,
  IconToday,
  IconViz,
} from "./icons";
import { FUB_META } from "./ui";
import { DashboardScreen } from "./screens/dashboard";
import { TodayScreen } from "./screens/today";
import { BuyerScoutScreen } from "./screens/buyer-scout";
import { ListingStudioScreen } from "./screens/listing-studio";
import { OmStudioScreen } from "./screens/om-studio";
import { DevelopmentVisualizerScreen } from "./screens/development-visualizer";
import { RentRollStudioScreen } from "./screens/rent-roll-studio";
import { CompLabScreen } from "./screens/comp-lab";
import { SignalScoutScreen } from "./screens/signal-scout";
import { PeopleScreen } from "./screens/people";
import { FubScreen } from "./screens/follow-up-boss";
import { SettingsScreen } from "./screens/settings";
import { NoteDialog, EmailDialog, DetailDialog } from "./dialogs";

const TITLES: Record<Screen, string> = {
  dashboard: "Dashboard",
  today: "Today",
  scout: "Buyer Scout",
  studio: "Listing Studio",
  om: "OM Studio",
  visualizer: "Development Visualizer",
  rentroll: "Rent Roll Studio",
  complab: "Comp Lab",
  signals: "Signal Scout",
  people: "People & Deals",
  fub: "Follow Up Boss",
  settings: "Settings",
};

const NAV: { id: Screen; label: string; Icon: typeof IconToday }[] = [
  { id: "dashboard", label: "Dashboard", Icon: IconDash },
  { id: "today", label: "Today", Icon: IconToday },
  { id: "scout", label: "Buyer Scout", Icon: IconScout },
  { id: "studio", label: "Listing Studio", Icon: IconStudio },
  { id: "om", label: "OM Studio", Icon: IconOm },
  { id: "visualizer", label: "Dev Visualizer", Icon: IconViz },
  { id: "rentroll", label: "Rent Roll Studio", Icon: IconRent },
  { id: "complab", label: "Comp Lab", Icon: IconComp },
  { id: "signals", label: "Signal Scout", Icon: IconSignal },
  { id: "people", label: "People & Deals", Icon: IconPeople },
  { id: "fub", label: "Follow Up Boss", Icon: IconFub },
  { id: "settings", label: "Settings", Icon: IconSettings },
];

export function AppShell() {
  const app = useApp();
  const fubMeta = FUB_META[app.fubSync];
  const lastSync = app.fubSync === "disconnected" ? "—" : app.lastSync;

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "stretch", fontFamily: "var(--font-body)", fontSize: 14 }}>
      <aside
        aria-label="Primary navigation"
        style={{
          width: 220,
          flex: "none",
          borderRight: "2px solid var(--color-divider)",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div style={{ padding: "20px 16px 16px", borderBottom: "2px solid var(--color-divider)" }}>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 19, letterSpacing: "-0.01em" }}>AgentOS</div>
          <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
            Local-first · works with Follow Up Boss
          </div>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", padding: "10px 0", gap: 2 }}>
          {NAV.map(({ id, label, Icon }) => {
            const active = app.screen === id;
            return (
              <button
                key={id}
                onClick={() => app.setScreen(id)}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  textAlign: "left",
                  font: "inherit",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  padding: "9px 16px 9px 13px",
                  borderLeft: `3px solid ${active ? "var(--color-accent)" : "transparent"}`,
                  color: active ? "var(--color-accent)" : "inherit",
                  background: active ? "color-mix(in srgb, var(--color-accent) 8%, transparent)" : "transparent",
                }}
              >
                <Icon />
                {label}
              </button>
            );
          })}
        </nav>
        <div style={{ marginTop: "auto", padding: "14px 16px", borderTop: "2px solid var(--color-divider)", display: "flex", flexDirection: "column", gap: 6 }}>
          <span className={fubMeta.chipClass}>FUB · {fubMeta.chip}</span>
          <span className="text-muted" style={{ fontSize: 11 }}>
            Last sync {lastSync}
          </span>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "14px 28px",
            borderBottom: "2px solid var(--color-divider)",
            flexWrap: "wrap",
          }}
        >
          <h4 style={{ margin: 0, fontSize: 18 }}>{TITLES[app.screen]}</h4>
          <input
            className="input"
            style={{ maxWidth: 340, marginLeft: "auto" }}
            placeholder="Search people, addresses, MLS #  ⌘K"
            aria-label="Search people, addresses, and MLS numbers"
          />
          <button className="btn btn-primary" onClick={app.openNote}>
            <IconMic size={14} />
            Capture note
          </button>
        </header>

        <div style={{ flex: 1, overflow: "auto", padding: "26px 28px 48px" }}>
          {app.screen === "dashboard" && <DashboardScreen />}
          {app.screen === "today" && <TodayScreen />}
          {app.screen === "scout" && <BuyerScoutScreen />}
          {app.screen === "studio" && <ListingStudioScreen />}
          {app.screen === "om" && <OmStudioScreen />}
          {app.screen === "visualizer" && <DevelopmentVisualizerScreen />}
          {app.screen === "rentroll" && <RentRollStudioScreen />}
          {app.screen === "complab" && <CompLabScreen />}
          {app.screen === "signals" && <SignalScoutScreen />}
          {app.screen === "people" && <PeopleScreen />}
          {app.screen === "fub" && <FubScreen />}
          {app.screen === "settings" && <SettingsScreen />}
        </div>
      </main>

      <NoteDialog />
      <EmailDialog />
      <DetailDialog />

      {app.toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            left: 24,
            bottom: 24,
            zIndex: 80,
            background: "var(--color-neutral-900)",
            color: "var(--color-neutral-100)",
            padding: "12px 18px",
            fontSize: 13,
            boxShadow: "var(--shadow-lg)",
            maxWidth: 420,
          }}
        >
          {app.toast}
        </div>
      )}
    </div>
  );
}
