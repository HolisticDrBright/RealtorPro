import "server-only";
import { and, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { generationJobs } from "@/db/schema";
import { AppError } from "./errors";

/**
 * Rate / cost guardrails for the generation job queue.
 *
 * Limits are read from env (with policy defaults). A preflight COST ESTIMATE is
 * checked before a job is allowed to run, and the number of jobs per rolling
 * hour plus a daily spend cap are enforced against the audit trail in the DB.
 */
export interface GenerationLimits {
  maxJobsPerHour: number;
  maxJobCostUsd: number;
  dailySpendCapUsd: number;
}

export function getLimits(): GenerationLimits {
  return {
    maxJobsPerHour: Number(process.env.AGENTOS_MAX_JOBS_PER_HOUR ?? 20),
    maxJobCostUsd: Number(process.env.AGENTOS_MAX_JOB_COST_USD ?? 25),
    dailySpendCapUsd: Number(process.env.AGENTOS_DAILY_SPEND_CAP_USD ?? 100),
  };
}

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

/**
 * Throw a structured `rate_limited` error if creating/running a job with the
 * given estimated cost would breach any limit.
 */
export function assertWithinGenerationLimits(estimatedCostUsd: number) {
  const limits = getLimits();

  if (estimatedCostUsd > limits.maxJobCostUsd) {
    throw new AppError(
      "rate_limited",
      `Estimated cost $${estimatedCostUsd.toFixed(2)} exceeds the per-job cap of $${limits.maxJobCostUsd.toFixed(2)}.`,
      { limit: "maxJobCostUsd" },
    );
  }

  const jobsLastHour = db
    .select({ n: sql<number>`count(*)` })
    .from(generationJobs)
    .where(gte(generationJobs.createdAt, isoHoursAgo(1)))
    .get();
  if ((jobsLastHour?.n ?? 0) >= limits.maxJobsPerHour) {
    throw new AppError(
      "rate_limited",
      `Generation rate limit reached (${limits.maxJobsPerHour} jobs/hour). Try again later.`,
      { limit: "maxJobsPerHour" },
    );
  }

  const spentToday = db
    .select({ total: sql<number>`coalesce(sum(${generationJobs.costEstimateUsd}), 0)` })
    .from(generationJobs)
    .where(
      and(
        gte(generationJobs.createdAt, isoHoursAgo(24)),
        gte(generationJobs.costEstimateUsd, 0),
      ),
    )
    .get();
  const projected = (spentToday?.total ?? 0) + estimatedCostUsd;
  if (projected > limits.dailySpendCapUsd) {
    throw new AppError(
      "rate_limited",
      `This job would push today's estimated spend to $${projected.toFixed(2)}, over the $${limits.dailySpendCapUsd.toFixed(2)} daily cap.`,
      { limit: "dailySpendCapUsd" },
    );
  }
}
