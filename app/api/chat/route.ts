import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = (process.env.MISTRAL_API_URL ?? "https://api.mistral.ai")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/v1$/, "");
const MODEL = process.env.MISTRAL_MODEL ?? "mistral-small-latest";
const MAX_MESSAGES = 100;
const MAX_CONTENT_LENGTH = 32_000;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

function parseMessages(raw: unknown): IncomingMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) {
    return null;
  }
  const messages: IncomingMessage[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return null;
    const m = item as Record<string, unknown>;
    if (
      (m.role !== "user" && m.role !== "assistant") ||
      typeof m.content !== "string" ||
      m.content.trim().length === 0 ||
      m.content.length > MAX_CONTENT_LENGTH
    ) {
      return null;
    }
    messages.push({ role: m.role, content: m.content });
  }
  return messages;
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

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
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
      // Keep the generic message.
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
    return errorResponse(
      502,
      detail
        ? `The AI service returned an error: ${detail}`
        : "The AI service returned an unexpected error. Please try again."
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
