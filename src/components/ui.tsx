/** Small shared presentational helpers used across screens. */

export function ImageSlot({ label, ratio = "4 / 3" }: { label: string; ratio?: string }) {
  return (
    <div className="grayscale" style={{ aspectRatio: ratio }}>
      <div className="image-slot">{label}</div>
    </div>
  );
}

export const FUB_META: Record<
  string,
  { title: string; chip: string; chipClass: string; showErr: boolean; connected: boolean; body: string }
> = {
  healthy: {
    title: "Connected to Follow Up Boss",
    chip: "Connected",
    chipClass: "tag tag-accent",
    showErr: false,
    connected: true,
    body:
      "Two-way sync is healthy. AgentOS pulls contacts, deals, tasks and notes into your local workspace, and pushes back only drafts and tasks for your approval.",
  },
  "sync-error": {
    title: "Connected — last push failed",
    chip: "Sync error",
    chipClass: "tag tag-outline",
    showErr: true,
    connected: true,
    body:
      "The connection is live, but the last push did not complete. Your local copies are safe and will retry — nothing is lost or sent twice.",
  },
  disconnected: {
    title: "Not connected",
    chip: "Disconnected",
    chipClass: "tag tag-neutral",
    showErr: false,
    connected: false,
    body:
      "Connect your Follow Up Boss account to pull contacts, deals, tasks and notes. AgentOS stores everything locally and never sends messages on its own.",
  },
};
