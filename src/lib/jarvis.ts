export interface JarvisSource { entity: string; id: string; label: string; href: string }
export interface ScheduleDraft { entity: "tasks" | "calls" | "appointments"; fields: Record<string, unknown> }
export interface JarvisTurn {
  id: string; parentId: string | null; question: string; answer: string | null;
  status: string; error: string | null; model: string; timeZone: string;
  sources: JarvisSource[]; drafts: ScheduleDraft[]; reviewId: string | null;
  reviewStatus?: string | null; createdAt: string;
  usage: { inputTokens: number; outputTokens: number; requests: number } | null;
}
