import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = (process.env.MISTRAL_API_URL ?? "https://api.mistral.ai")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/v1$/, "");
const MODEL = process.env.MISTRAL_MODEL ?? "mistral-small-latest";
const CACHE_TTL_MS = 5 * 60 * 1000;

const NON_CHAT_PATTERN =
  /(whisper|tts|guard|embed|speech|playai|distil|bge|rerank|moderation|safety|orpheus|kokoro|piper|voice)/i;

let cache: { at: number; models: string[] } | null = null;

function envModels(): string[] {
  const extra = (process.env.MISTRAL_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter((model) => model.length > 0 && model.length <= 100);
  return Array.from(new Set([MODEL, ...extra]));
}

function sortModels(models: string[]): string[] {
  const rest = models.filter((m) => m !== MODEL).sort((a, b) => a.localeCompare(b));
  return [MODEL, ...rest];
}

async function providerModels(apiKey: string): Promise<string[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.models;
  const upstream = await fetch(`${API_URL}/v1/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!upstream.ok) throw new Error(`models request failed: ${upstream.status}`);
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

export async function GET() {
  if (process.env.MISTRAL_MODELS) {
    return NextResponse.json({ models: envModels(), default: MODEL });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (apiKey) {
    try {
      const models = sortModels(Array.from(new Set([MODEL, ...await providerModels(apiKey)])));
      return NextResponse.json({ models, default: MODEL });
    } catch {
      // Fall through to the single-model default below.
    }
  }

  return NextResponse.json({ models: [MODEL], default: MODEL });
}
