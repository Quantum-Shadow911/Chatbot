import { NextRequest, NextResponse } from "next/server";
import { supportsVision } from "@/lib/vision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = normalizeBase(process.env.MISTRAL_API_URL ?? "https://api.mistral.ai");
const MODEL = process.env.MISTRAL_MODEL ?? "mistral-small-latest";
const VISION_MODEL = (process.env.VISION_MODEL ?? "").trim();
const VISION_API_KEY = (process.env.VISION_API_KEY ?? "").trim();
const VISION_API_URL = normalizeBase(
  process.env.VISION_API_URL ?? "https://api.mistral.ai"
);
const MODEL_PATTERN = /^[A-Za-z0-9._:/-]{1,100}$/;

function normalizeBase(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/v1$/, "")
    .replace(/\/chat\/completions$/, "");
}

function completionsUrl(base: string): string {
  if (/\/(v\d+|openai)$/.test(base)) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

function parseModel(raw: unknown): string {
  if (typeof raw !== "string") return MODEL;
  const model = raw.trim();
  return MODEL_PATTERN.test(model) ? model : MODEL;
}
const MAX_MESSAGES = 100;
const MAX_CONTENT_LENGTH = 32_000;
const MAX_PARTS = 8;
const MAX_IMAGE_PART_LENGTH = 6_000_000;
const MAX_TOTAL_LENGTH = 14_000_000;
const MAX_MEMORIES = 50;
const MAX_MEMORY_LENGTH = 200;
const MAX_MEMORY_TOTAL = 8_000;

const BASE_SYSTEM_PROMPT =
  "You are a helpful, friendly AI assistant. Format responses with Markdown when it improves readability.";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface IncomingMessage {
  role: "user" | "assistant";
  content: string | ContentPart[];
}

const DATA_URL_PATTERN = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

function totalLength(content: string | ContentPart[]): number {
  if (typeof content === "string") return content.length;
  return content.reduce((sum, part) => {
    if (part.type === "text") return sum + part.text.length;
    return sum + part.image_url.url.length;
  }, 0);
}

function parseContent(raw: unknown): string | ContentPart[] | null {
  if (typeof raw === "string") {
    if (raw.trim().length === 0 || raw.length > MAX_CONTENT_LENGTH) return null;
    return raw;
  }
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_PARTS) return null;
  const parts: ContentPart[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return null;
    const part = item as Record<string, unknown>;
    if (part.type === "text") {
      if (typeof part.text !== "string" || part.text.length > MAX_CONTENT_LENGTH) {
        return null;
      }
      parts.push({ type: "text", text: part.text });
    } else if (part.type === "image_url") {
      const image = part.image_url;
      if (typeof image !== "object" || image === null) return null;
      const url = (image as Record<string, unknown>).url;
      if (
        typeof url !== "string" ||
        !DATA_URL_PATTERN.test(url) ||
        url.length > MAX_IMAGE_PART_LENGTH
      ) {
        return null;
      }
      parts.push({ type: "image_url", image_url: { url } });
    } else {
      return null;
    }
  }
  if (totalLength(parts) > MAX_TOTAL_LENGTH) return null;
  return parts;
}

function parseMessages(raw: unknown): IncomingMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) {
    return null;
  }
  const messages: IncomingMessage[] = [];
  let total = 0;
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return null;
    const m = item as Record<string, unknown>;
    if (m.role !== "user" && m.role !== "assistant") return null;
    const content = parseContent(m.content);
    if (content === null) return null;
    total += totalLength(content);
    if (total > MAX_TOTAL_LENGTH) return null;
    messages.push({ role: m.role, content });
  }
  return messages;
}

function parseMemories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const memories: string[] = [];
  let total = 0;
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const text = item.trim().slice(0, MAX_MEMORY_LENGTH);
    if (text.length === 0) continue;
    total += text.length;
    if (total > MAX_MEMORY_TOTAL || memories.length >= MAX_MEMORIES) break;
    memories.push(text);
  }
  return memories;
}

function buildSystemMessage(memories: string[]): string {
  if (memories.length === 0) return BASE_SYSTEM_PROMPT;
  return `${BASE_SYSTEM_PROMPT}\n\nLong-term memories about the user, gathered from previous conversations:\n${memories
    .map((memory) => `- ${memory}`)
    .join("\n")}\n\nUse these memories naturally when they are relevant. Do not repeat them back unless the user asks.`;
}

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function extractDetail(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const obj = data as Record<string, unknown>;
  const candidates: unknown[] = [obj.message, obj.detail];
  if (typeof obj.error === "object" && obj.error !== null) {
    candidates.push((obj.error as Record<string, unknown>).message);
  } else if (typeof obj.error === "string") {
    candidates.push(obj.error);
  }
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
    if (Array.isArray(candidate)) {
      const joined = candidate.map(String).join(" ").trim();
      if (joined.length > 0) return joined;
    }
  }
  return "";
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return errorResponse(
      500,
      "The AI service is not configured. Set MISTRAL_API_KEY on the server and try again."
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Invalid request body.");
  }

  const rawMessages =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).messages
      : undefined;
  const messages = parseMessages(rawMessages);
  if (!messages) {
    return errorResponse(400, "Invalid conversation payload.");
  }

  const memories = parseMemories(
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).memories
      : undefined
  );
  const model = parseModel(
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).model
      : undefined
  );

  let upstream: Response;
  const hasImages = messages.some(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some((part) => part.type === "image_url")
  );
  let targetUrl = completionsUrl(API_URL);
  let targetKey = apiKey;
  let targetModel = model;
  if (
    hasImages &&
    !supportsVision(model) &&
    VISION_API_KEY &&
    VISION_MODEL
  ) {
    targetUrl = completionsUrl(VISION_API_URL);
    targetKey = VISION_API_KEY;
    targetModel = VISION_MODEL;
  }
  try {
    upstream = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${targetKey}`,
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [
          { role: "system", content: buildSystemMessage(memories) },
          ...messages,
        ],
        stream: true,
      }),
    });
  } catch {
    return errorResponse(
      502,
      "Could not reach the AI service. Check your network connection and try again."
    );
  }

  if (!upstream.ok || !upstream.body) {
    let detail = "";
    try {
      const data: unknown = await upstream.json();
      detail = extractDetail(data);
    } catch {
      try {
        detail = (await upstream.text()).slice(0, 200);
      } catch {
        // Keep the generic message.
      }
    }

    if (upstream.status === 429) {
      return errorResponse(
        429,
        "The AI service is rate limited right now. Please wait a moment and try again."
      );
    }
    if (upstream.status === 401 || upstream.status === 403) {
      return errorResponse(
        502,
        "The AI service rejected the server credentials. Check the configured API key."
      );
    }
    const imageHint =
      hasImages && !detail
        ? " The selected model may not support image input — pick a vision-capable model from the header dropdown and try again."
        : "";
    return errorResponse(
      502,
      detail
        ? `The AI service returned an error: ${detail}${imageHint}`
        : `The AI service returned an unexpected error. Please try again.${imageHint}`
    );
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
