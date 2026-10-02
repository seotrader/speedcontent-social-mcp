#!/usr/bin/env node
/**
 * MCP server for the SpeedContent Social Post API.
 *
 * Exposes social post generation to agents. The underlying HTTP API is
 * asynchronous (submit, then poll), but an agent calling a tool wants one
 * answer, so `generate_social_post` polls to completion before returning.
 * `check_social_job` is there for the rare job that outlives the tool timeout.
 */

import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

const BASE_URL =
  process.env.SPEEDCONTENT_BASE_URL ??
  "https://generatecontentwithaiservice-g5zrtckfda-ue.a.run.app";

const API_KEY = process.env.SPEEDCONTENT_API_KEY;

const PLATFORMS = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "pinterest",
  "youtube",
  "tiktok",
] as const;

const TONES = [
  "professional",
  "casual",
  "friendly",
  "humorous",
  "inspirational",
  "educational",
] as const;

/** Platform defaults, mirroring the API's own. Shown to agents so they can reason about length. */
const DEFAULT_WORDS: Record<string, number> = {
  facebook: 75,
  instagram: 50,
  twitter: 40,
  linkedin: 100,
  pinterest: 75,
  youtube: 150,
  tiktok: 50,
};

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 300_000;

interface SocialPost {
  platform: string;
  tone: string;
  topic: string;
  content: string;
  hashtags?: string[];
  image_prompt?: string | null;
  image_url?: string | null;
  ai_score?: number | null;
  character_count?: number;
}

interface JobStatus {
  job_id: string;
  status: string;
  progress: number;
  current_step?: string | null;
  estimated_credits?: number | null;
  actual_credits?: number | null;
  posts?: SocialPost[] | null;
  error?: string | null;
}

class ApiError extends Error {}

function requireKey(): string {
  if (!API_KEY) {
    throw new ApiError(
      "SPEEDCONTENT_API_KEY is not set. Create a key at " +
        "https://app.speedcontent.online/APIKeys and set it in the MCP server's environment.",
    );
  }
  return API_KEY;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let detail = await res.text();
    try {
      detail = (JSON.parse(detail) as { detail?: string }).detail ?? detail;
    } catch {
      // Not JSON — the raw body is the best message available.
    }
    // Map the codes an agent can actually act on to advice, not just a number.
    const advice: Record<number, string> = {
      401: "The API key was rejected. Check SPEEDCONTENT_API_KEY.",
      402: "Out of credits. Top up at https://app.speedcontent.online.",
      403: "The API key is inactive, or this job belongs to another account.",
      404: "No job with that id.",
      429: "Too many jobs running at once (maximum 3). Wait for one to finish.",
    };
    throw new ApiError(
      `${res.status} ${detail}${advice[res.status] ? ` — ${advice[res.status]}` : ""}`,
    );
  }

  return (await res.json()) as T;
}

/** Render a finished job for an agent: the post text first, metadata after. */
function renderPosts(job: JobStatus): string {
  const posts = job.posts ?? [];
  if (posts.length === 0) return "The job completed but returned no posts.";

  const blocks = posts.map((p, i) => {
    const lines = [
      posts.length > 1 ? `### Variation ${i + 1}` : `### ${p.platform} post`,
      "",
      p.content,
      "",
    ];
    if (p.hashtags?.length) lines.push(`Hashtags: ${p.hashtags.join(" ")}`);
    if (p.image_url) lines.push(`Image: ${p.image_url}`);
    lines.push(
      p.ai_score === null || p.ai_score === undefined
        ? "AI detection: not run for this post"
        : `AI detection score: ${p.ai_score} (0 = reads as human, 65 = maximum)`,
    );
    if (p.character_count) lines.push(`Length: ${p.character_count} characters`);
    return lines.join("\n");
  });

  const credits = job.actual_credits ?? job.estimated_credits;
  if (credits != null) blocks.push(`\n_Cost: ${credits} credits._`);
  return blocks.join("\n\n");
}

async function pollToCompletion(jobId: string): Promise<JobStatus> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const job = await call<JobStatus>(`/api/v1/social/jobs/${jobId}`);
    if (job.status === "completed" || job.status === "failed") return job;
  }
  throw new ApiError(
    `Job ${jobId} did not finish within ${POLL_TIMEOUT_MS / 1000}s. ` +
      `It may still be running — poll it with check_social_job.`,
  );
}

const server = new McpServer({
  name: "speedcontent-social",
  version: "0.1.0",
});

server.registerTool(
  "generate_social_post",
  {
    title: "Generate a social media post",
    description:
      "Write a social media post for a given platform and topic. The post is written to " +
      "that platform's conventions, rewritten to read as human-authored, optionally scored " +
      "against AI detection, and optionally illustrated with a generated image. " +
      "Blocks until generation finishes, typically 20-90 seconds. Costs credits.",
    inputSchema: {
      topic: z.string().min(3).describe("What the post should be about."),
      platform: z
        .enum(PLATFORMS)
        .describe("Target platform. Each has its own style guide and default length."),
      tone: z.enum(TONES).optional().describe("Defaults to friendly."),
      language: z.string().optional().describe("Output language by name. Defaults to English."),
      quantity: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("How many distinct variations to generate. Defaults to 1."),
      word_count: z
        .number()
        .int()
        .min(10)
        .max(500)
        .optional()
        .describe(
          "Target length per post. Omit to use the platform default " +
            "(LinkedIn 100, YouTube 150, Facebook/Pinterest 75, Instagram/TikTok 50, X 40).",
        ),
      generate_image: z
        .boolean()
        .optional()
        .describe("Generate a matching image. Defaults to true. Adds 10 credits per post."),
      detect_ai: z
        .boolean()
        .optional()
        .describe(
          "Score the post against AI detection and retry if it reads as machine-written. " +
            "Adds 8 credits per post. Omit for automatic: runs only at 150+ words, because " +
            "short posts score unreliably.",
        ),
      brand_name: z.string().optional().describe("Brand to mention where it reads naturally."),
      brand_description: z.string().optional().describe("What the business does."),
      brand_tone: z.string().optional().describe("Voice guidance, e.g. 'Direct, no jargon'."),
      brand_audience: z.string().optional().describe("Who the post should speak to."),
      brand_keywords: z.string().optional().describe("Comma-separated terms to work in."),
    },
  },
  async (args) => {
    try {
      const {
        brand_name,
        brand_description,
        brand_tone,
        brand_audience,
        brand_keywords,
        ...rest
      } = args;

      // The HTTP API takes brand voice as a nested object; flat args are easier for an agent.
      const brandVoice = { brand_name, brand_description, brand_tone, brand_audience, brand_keywords };
      const hasBrand = Object.values(brandVoice).some((v) => v != null && v !== "");

      const submitted = await call<{ job_id: string; estimated_credits: number }>(
        "/api/v1/social/generate",
        {
          method: "POST",
          body: JSON.stringify({ ...rest, ...(hasBrand ? { brand_voice: brandVoice } : {}) }),
        },
      );

      const job = await pollToCompletion(submitted.job_id);

      if (job.status === "failed") {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Generation failed: ${job.error ?? "no reason given"}. Credits were refunded.`,
            },
          ],
        };
      }

      return { content: [{ type: "text" as const, text: renderPosts(job) }] };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: (err as Error).message }],
      };
    }
  },
);

server.registerTool(
  "check_social_job",
  {
    title: "Check a social post job",
    description:
      "Look up a social post generation job by id. Use this only when generate_social_post " +
      "timed out and returned a job id — it does not start new work and costs nothing.",
    inputSchema: {
      job_id: z.string().describe("The job id returned by a previous call."),
    },
  },
  async ({ job_id }) => {
    try {
      const job = await call<JobStatus>(`/api/v1/social/jobs/${job_id}`);
      if (job.status === "completed") {
        return { content: [{ type: "text" as const, text: renderPosts(job) }] };
      }
      if (job.status === "failed") {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Job failed: ${job.error ?? "no reason given"}. Credits were refunded.`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `Still running — ${job.progress}%: ${job.current_step ?? job.status}`,
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: (err as Error).message }],
      };
    }
  },
);

server.registerTool(
  "list_social_platforms",
  {
    title: "List supported platforms",
    description:
      "List the platforms generate_social_post supports, with each one's default post length " +
      "and emoji policy. Costs nothing and makes no network call.",
    inputSchema: {},
  },
  async () => {
    const rows = PLATFORMS.map((p) => {
      const emoji = p === "linkedin" || p === "youtube" ? "none" : "yes";
      return `- ${p}: ${DEFAULT_WORDS[p]} words by default, emoji ${emoji}`;
    });
    return {
      content: [
        {
          type: "text" as const,
          text: `Supported platforms:\n${rows.join("\n")}\n\nTones: ${TONES.join(", ")}.`,
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
