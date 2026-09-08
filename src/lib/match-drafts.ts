import { z } from "zod";

export const MatchPair = z.object({ buyerId: z.string().min(1).max(100), candidateId: z.string().min(1).max(100), kind: z.enum(["listing", "opportunity"]) }).strict();
export const DraftOptions = z.object({
  tone: z.enum(["warm", "professional", "concise"]).default("warm"),
  instructions: z.string().trim().max(1500).default(""),
}).strict();
export const GenerateMatch = MatchPair.extend({ id: z.string().uuid(), consent: z.literal(true), options: DraftOptions }).strict();
export const DraftText = z.object({
  subject: z.string().trim().min(1).max(200).regex(/^[^\r\n]+$/, "Subject must be a single line"),
  email: z.string().trim().min(1).max(12000), sms: z.string().trim().min(1).max(1600),
}).strict();
export const DraftEdit = DraftText.extend({ recipient: z.union([z.string().email().max(254), z.literal("")]) }).strict();
export interface MatchDraft {
  id: string; buyerId: string; candidateId: string; kind: string; context: string; options: string;
  status: string; error: string | null; model: string; subject: string; email: string; sms: string;
  recipient: string; inPacket: boolean; revision: number;
  createdAt: string; updatedAt: string;
}
