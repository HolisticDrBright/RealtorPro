import { loadDashboard } from "@/services/dashboard";
import { writeBriefing, isClaudeConfigured } from "@/services/claude";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
export async function POST() {
  try {
    const d = loadDashboard();
    const facts = { today: d.today, agent: d.agent.name, goal: d.goal, ytd: d.kpis.ytd, pending: { volume: d.kpis.pendingVolume, net: d.kpis.pendingNet, count: d.kpis.pendingCount }, priorities: d.priorities.map((p) => ({ title: p.title, priority: p.priority, due: p.dueDate, kind: p.kind })), schedule: d.schedule.today.map((a) => ({ time: a.startsAt.slice(11, 16), title: a.title, who: a.contactName })), calls: d.callList.filter((c) => c.status !== "completed").map((c) => ({ name: c.contactName, reason: c.reason, type: c.clientType })), hotBuyers: d.hotBuyers.filter((b) => b.temperature === "hot").map((b) => ({ name: b.contactName, lastContact: b.lastContactAt, range: [b.priceMin, b.priceMax] })), escrows: d.escrows.map((e) => ({ address: e.address, daysToClose: e.daysToClose, next: e.nextMilestone })), alerts: d.alerts.map((a) => a.text), matches: d.matches.slice(0, 5).map((m) => `${m.buyerName} ↔ ${m.address} (${m.score})`) };
    if (!isClaudeConfigured()) return ok({ text: null, configured: false });
    return ok({ text: await writeBriefing(facts), configured: true });
  } catch (err) { return errorResponse(err); }
}
