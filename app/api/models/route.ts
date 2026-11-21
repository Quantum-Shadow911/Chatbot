import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = (process.env.MISTRAL_API_URL ?? "https://api.mistral.ai")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/v1$/, "");
const MODEL = process.env.MISTRAL_MODEL ?? "mistral-small-latest";
const VISION_MODEL = (process.env.VISION_MODEL ?? "").trim();
const VISION_API_KEY = (process.env.VISION_API_KEY ?? "").trim();
const VISION_FALLBACK = Boolean(VISION_API_KEY && VISION_MODEL);
const CACHE_TTL_MS = 5 * 60 * 1000;

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY ?? "").trim();
const OPENAI_URL = "https://api.openai.com/v1";
const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY ?? "").trim();
const ANTHROPIC_URL = "https://api.anthropic.com/v1";

const OPENAI_MODELS_ENV = (process.env.OPENAI_MODELS ?? "")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m.length > 0 && m.length <= 100);
const ANTHROPIC_MODELS_ENV = (process.env.ANTHROPIC_MODELS ?? "")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m.length > 0 && m.length <= 100);

const OPENAI_FALLBACK = [
  "gpt-5",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o",
  "gpt-4o-mini",
  "o3",
  "o4-mini",
];
const ANTHROPIC_FALLBACK = [
  "claude-opus-4-5",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
];

const NON_CHAT_PATTERN =
  /(whisper|tts|guard|embed|speech|playai|distil|bge|rerank|moderation|safety|orpheus|kokoro|piper|voice)/i;
const OPENAI_EXCLUDE_PATTERN =
  /(dall-e|gpt-image|embedding|moderation|realtime|transcribe|audio|babbage|davinci|search|computer-use)/i;

let cache: { at: number; models: string[] } | null = null;
let openaiCache: { at: number; models: string[] } | null = null;
let anthropicCache: { at: number; models: string[] } | null = null;

function envModels(): string[] {
  const extra = (process.env.MISTRAL_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter((model) => model.length > 0 && model.length <= 100);
  return withVision(Array.from(new Set([MODEL, ...extra])));
}

function withVision(models: string[]): string[] {
  if (!VISION_MODEL) return models;
  return Array.from(new Set([...models, VISION_MODEL]));
}

function sortModels(models: string[]): string[] {
  const rest = models.filter((m) => m !== MODEL).sort((a, b) => a.localeCompare(b));
  return [MODEL, ...rest];
}

async function providerModels(apiKey: string): Promise<string[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.models;
  const upstream = await fetch(API_URL + "/v1/models", {
    headers: { Authorization: "Bearer " + apiKey },
    signal: AbortSignal.timeout(8000),
  });
  if (!upstream.ok) throw new Error("models request failed: " + upstream.status);
  const data: unknown = await upstream.json();
  const entries = (data as Record<string, unknown>).data;
  if (!Array.isArray(entries)) throw new Error("unexpected models payload");
  const ids = entries
    .map((entry) =>
      typeof entry === "object" && entry !== null
        ? (entry as Record<string, unknown>).id
        : undefined
    )
    .filter((id): id is string => typeof id === "string" && id.length <= 100)
    .filter((id) => !NON_CHAT_PATTERN.test(id));
  if (ids.length === 0) throw new Error("no models returned");
  cache = { at: Date.now(), models: ids };
  return ids;
}

async function openaiModelList(): Promise<string[]> {
  if (OPENAI_MODELS_ENV.length > 0) {
    return OPENAI_MODELS_ENV.map((id) => "openai::" + id);
  }
  if (!OPENAI_API_KEY) return [];
  if (openaiCache && Date.now() - openaiCache.at < CACHE_TTL_MS) return openaiCache.models;
  try {
    const res = await fetch(OPENAI_URL + "/models", {
      headers: { Authorization: "Bearer " + OPENAI_API_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error("openai models failed");
    const data: unknown = await res.json();
    const entries = (data as Record<string, unknown>).data;
    if (!Array.isArray(entries)) throw new Error("unexpected openai payload");
    const ids = entries
      .map((entry) =>
        typeof entry === "object" && entry !== null
          ? (entry as Record<string, unknown>).id
          : undefined
      )
      .filter((id): id is string => typeof id === "string" && id.length <= 100)
      .filter((id) => !NON_CHAT_PATTERN.test(id) && !OPENAI_EXCLUDE_PATTERN.test(id));
    if (ids.length === 0) throw new Error("no openai models");
    const prefixed = ids.map((id) => "openai::" + id);
    openaiCache = { at: Date.now(), models: prefixed };
    return prefixed;
  } catch {
    return OPENAI_FALLBACK.map((id) => "openai::" + id);
  }
}

async function anthropicModelList(): Promise<string[]> {
  if (ANTHROPIC_MODELS_ENV.length > 0) {
    return ANTHROPIC_MODELS_ENV.map((id) => "anthropic::" + id);
  }
  if (!ANTHROPIC_API_KEY) return [];
  if (anthropicCache && Date.now() - anthropicCache.at < CACHE_TTL_MS) return anthropicCache.models;
  try {
    const res = await fetch(ANTHROPIC_URL + "/models?limit=100", {
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error("anthropic models failed");
    const data: unknown = await res.json();
    const entries = (data as Record<string, unknown>).data;
    if (!Array.isArray(entries)) throw new Error("unexpected anthropic payload");
    const ids = entries
      .map((entry) =>
        typeof entry === "object" && entry !== null
          ? (entry as Record<string, unknown>).id
          : undefined
      )
      .filter((id): id is string => typeof id === "string" && id.length <= 100)
      .filter((id) => id.startsWith("claude"));
    if (ids.length === 0) throw new Error("no anthropic models");
    const prefixed = ids.map((id) => "anthropic::" + id);
    anthropicCache = { at: Date.now(), models: prefixed };
    return prefixed;
  } catch {
    return ANTHROPIC_FALLBACK.map((id) => "anthropic::" + id);
  }
}

export async function GET() {
  const [openai, anthropic] = await Promise.all([openaiModelList(), anthropicModelList()]);

  let base: string[];
  if (process.env.MISTRAL_MODELS) {
    base = envModels();
  } else if (process.env.MISTRAL_API_KEY) {
    try {
      base = withVision(
        Array.from(new Set([MODEL, ...await providerModels(process.env.MISTRAL_API_KEY)]))
      );
    } catch {
      base = withVision([MODEL]);
    }
  } else {
    base = withVision([MODEL]);
  }

  const models = sortModels(Array.from(new Set([...base, ...openai, ...anthropic])));
  return NextResponse.json({
    models,
    default: MODEL,
    visionFallback: VISION_FALLBACK,
    providers: { openai: Boolean(OPENAI_API_KEY), anthropic: Boolean(ANTHROPIC_API_KEY) },
  });
}
