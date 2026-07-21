import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  drafts as draftsTable,
  facts as factsTable,
  generatedClaims,
  generationJobs,
  mediaDisclosures,
  properties,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { assertWithinGenerationLimits } from "@/lib/rate-limit";
import { assessText } from "@/lib/fair-housing";
import { remoteNeedsApproval } from "@/lib/gates";
import type { CreateJobInput } from "@/lib/validation";
import {
  getImageVideoProvider,
  getLlmProvider,
  getVideoAssembler,
} from "./providers";
import type { FactRef, LlmDraftRequest } from "./providers/types";

const PROMPT_VERSION = "campaign/v1";

function loadFacts(propertyId: string): FactRef[] {
  const rows = db.select().from(factsTable).where(eq(factsTable.propertyId, propertyId)).all();
  return rows
    .filter((r) => r.value)
    .map((r) => ({ field: r.field, value: r.value as string, source: r.source }));
}

/** Preflight COST ESTIMATE + remote determination — no side effects. */
export function estimateJob(input: CreateJobInput) {
  const property = db.select().from(properties).where(eq(properties.id, input.propertyId)).get();
  if (!property) throw new AppError("not_found", "Property not found.");
  const facts = loadFacts(input.propertyId);

  const llm = getLlmProvider();
  const media = getImageVideoProvider();
  const req: LlmDraftRequest = {
    promptVersion: PROMPT_VERSION,
    brandVoice: input.settings.brandVoice,
    goal: input.settings.campaignGoal,
    creativeDirection: input.settings.creativeDirection,
    facts,
    address: property.address,
  };
  const costEstimateUsd = Number(
    (llm.estimateCostUsd(req) + media.estimateImageCostUsd() + media.estimateVideoCostUsd()).toFixed(4),
  );
  const isRemote =
    input.remote ||
    (process.env.AGENTOS_LLM_PROVIDER ?? "mock") !== "mock" ||
    (process.env.AGENTOS_MEDIA_PROVIDER ?? "mock") !== "mock";

  return { property, facts, req, costEstimateUsd, isRemote, provider: llm.name, model: llm.model };
}

/** Create a job row. Local jobs run immediately; remote jobs await approval. */
export function createJob(input: CreateJobInput) {
  // Fair Housing guardrail on free-text creative direction before anything runs.
  if (input.settings.creativeDirection) {
    const fh = assessText(input.settings.creativeDirection);
    if (!fh.allowed) {
      throw new AppError(
        "fair_housing_violation",
        "The creative direction contains language that could steer on a protected class. Remove it and try again.",
        { violations: fh.violations },
      );
    }
  }

  const { req, costEstimateUsd, isRemote, provider, model } = estimateJob(input);

  const job = db
    .insert(generationJobs)
    .values({
      propertyId: input.propertyId,
      type: input.type,
      status: isRemote ? "queued" : "queued",
      provider,
      model,
      promptVersion: PROMPT_VERSION,
      inputs: { settings: input.settings, facts: req.facts },
      costEstimateUsd,
      isRemote,
      approvedForRemote: false,
    })
    .returning()
    .get();

  writeAudit({
    action: "generation.job.created",
    entityType: "generation_job",
    entityId: job.id,
    metadata: { provider, model, promptVersion: PROMPT_VERSION, costEstimateUsd, isRemote },
  });

  return { job, needsApproval: isRemote };
}

/** Approve a remote job for generation (explicit user approval gate). */
export function approveRemote(jobId: string, approvedBy: string) {
  const job = db.select().from(generationJobs).where(eq(generationJobs.id, jobId)).get();
  if (!job) throw new AppError("not_found", "Job not found.");
  db.update(generationJobs)
    .set({ approvedForRemote: true, updatedAt: new Date().toISOString() })
    .where(eq(generationJobs.id, jobId))
    .run();
  writeAudit({
    action: "generation.remote.approved",
    actor: approvedBy,
    entityType: "generation_job",
    entityId: jobId,
    metadata: { costEstimateUsd: job.costEstimateUsd },
  });
  return runJob(jobId);
}

/**
 * Execute a job: draft copy from facts, generate media, assemble video, persist
 * drafts + generated claims + disclosures, and move the job to `review`.
 */
export async function runJob(jobId: string) {
  const job = db.select().from(generationJobs).where(eq(generationJobs.id, jobId)).get();
  if (!job) throw new AppError("not_found", "Job not found.");
  // Approval gate (pure logic in lib/gates): remote jobs must be approved first.
  if (remoteNeedsApproval({ isRemote: job.isRemote, approvedForRemote: job.approvedForRemote })) {
    throw new AppError(
      "approval_required",
      "This job runs on a remote provider and needs explicit approval before generation.",
      { jobId, costEstimateUsd: job.costEstimateUsd },
    );
  }

  // Enforce cost / rate limits at run time.
  assertWithinGenerationLimits(job.costEstimateUsd ?? 0);

  db.update(generationJobs)
    .set({ status: "running", updatedAt: new Date().toISOString() })
    .where(eq(generationJobs.id, jobId))
    .run();

  try {
    const property = db.select().from(properties).where(eq(properties.id, job.propertyId!)).get();
    if (!property) throw new AppError("not_found", "Property not found.");
    const inputs = (job.inputs ?? {}) as { settings?: CreateJobInput["settings"]; facts?: FactRef[] };
    const facts = inputs.facts ?? loadFacts(property.id);
    const settings = inputs.settings;

    const llm = getLlmProvider();
    const media = getImageVideoProvider();
    const assembler = getVideoAssembler();

    const draftReq: LlmDraftRequest = {
      promptVersion: PROMPT_VERSION,
      brandVoice: settings?.brandVoice ?? "Warm, concrete, no hype",
      goal: settings?.campaignGoal,
      creativeDirection: settings?.creativeDirection,
      facts,
      address: property.address,
    };

    const copy = await llm.draftCampaignCopy(draftReq);

    const treatment = settings?.visualTreatment ?? "";
    const heroImage = await media.generateImage({
      promptVersion: PROMPT_VERSION,
      prompt: `Exterior hero for ${property.address}`,
      treatment,
    });
    const video = await media.generateVideo({
      promptVersion: PROMPT_VERSION,
      prompt: `Listing walkthrough for ${property.address}`,
      treatment,
      format: settings?.videoFormat ?? "9:16 vertical · 0:30",
    });
    const assembled = await assembler.assemble({
      format: settings?.videoFormat ?? "9:16 vertical · 0:30",
      beats: [
        "Corner-lot exterior push-in",
        "Entry → living room",
        "Kitchen pan",
        "Primary suite",
        "End card + disclosure",
      ],
      inputPaths: [],
      disclosure: video.disclosure,
    });

    // Persist MLS-description draft + one generated claim per paragraph.
    const mlsDraft = db
      .insert(draftsTable)
      .values({
        kind: "mls_description",
        propertyId: property.id,
        jobId: job.id,
        title: "MLS description",
        content: { paragraphs: copy.paragraphs },
        status: "draft",
        provider: copy.provider,
        model: copy.model,
        promptVersion: copy.promptVersion,
      })
      .returning()
      .get();
    for (const p of copy.paragraphs) {
      db.insert(generatedClaims)
        .values({ draftId: mlsDraft.id, text: p.text, sources: p.sources, factIds: [] })
        .run();
    }

    const socialDraft = db
      .insert(draftsTable)
      .values({
        kind: "social_plan",
        propertyId: property.id,
        jobId: job.id,
        title: "Social plan",
        content: { plan: copy.social },
        status: "draft",
        provider: copy.provider,
        model: copy.model,
        promptVersion: copy.promptVersion,
      })
      .returning()
      .get();

    // Disclosure records for any AI-altered media.
    const disclosures: string[] = [];
    if (heroImage.altered && heroImage.disclosure) {
      const d = db
        .insert(mediaDisclosures)
        .values({
          alteration: `Hero image — ${treatment || "AI enhancement"}`,
          disclosureText: heroImage.disclosure,
          status: "pending",
        })
        .returning()
        .get();
      disclosures.push(d.id);
    }
    if (video.altered && video.disclosure) {
      const d = db
        .insert(mediaDisclosures)
        .values({
          alteration: "Listing video — virtual twilight frame",
          disclosureText: video.disclosure,
          status: "pending",
        })
        .returning()
        .get();
      disclosures.push(d.id);
    }

    const outputs = {
      drafts: { mls: mlsDraft.id, social: socialDraft.id },
      media: { hero: heroImage, video },
      assembled,
      disclosures,
    };

    db.update(generationJobs)
      .set({ status: "review", outputs, updatedAt: new Date().toISOString() })
      .where(eq(generationJobs.id, jobId))
      .run();

    writeAudit({
      action: "generation.job.completed",
      entityType: "generation_job",
      entityId: job.id,
      metadata: {
        provider: copy.provider,
        model: copy.model,
        promptVersion: copy.promptVersion,
        inputs: { settings, factCount: facts.length },
        outputs: { draftIds: [mlsDraft.id, socialDraft.id], disclosures, assembled: assembled.assembled },
      },
    });

    return { job: { ...job, status: "review" }, outputs };
  } catch (err) {
    db.update(generationJobs)
      .set({
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(generationJobs.id, jobId))
      .run();
    writeAudit({
      action: "generation.job.failed",
      entityType: "generation_job",
      entityId: jobId,
      metadata: { error: err instanceof Error ? err.message : "unknown" },
    });
    throw err;
  }
}

export function cancelJob(jobId: string) {
  const job = db.select().from(generationJobs).where(eq(generationJobs.id, jobId)).get();
  if (!job) throw new AppError("not_found", "Job not found.");
  db.update(generationJobs)
    .set({ status: "canceled", updatedAt: new Date().toISOString() })
    .where(and(eq(generationJobs.id, jobId)))
    .run();
  writeAudit({ action: "generation.job.canceled", entityType: "generation_job", entityId: jobId });
  return { ok: true };
}
