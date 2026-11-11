import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = (process.env.MISTRAL_API_URL ?? "https://api.mistral.ai")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/v1$/, "");
const MODEL = process.env.MISTRAL_MODEL ?? "mistral-small-latest";

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 8_000;
const MAX_TOTAL_LENGTH = 60_000;
const MAX_EXTRACTED = 5;
const MAX_MEMORY_LENGTH = 200;

const EXTRACTION_PROMPT = `You maintain long-term memory for an AI assistant. From the conversation transcript, extract durable facts worth remembering in FUTURE conversations: the user's name, personal details, preferences, ongoing projects, goals, or important context they shared.

Rules:
- Write each memory as one short third-person statement (e.g. "The user's name is Alex", "The user is building a game in Python").
- Only durable information. Ignore small talk, temporary questions, and anything already listed under "Known memories".
- Maximum ${MAX_EXTRACTED} memories. Respond with ONLY a JSON array of strings. If nothing is worth remembering, respond with [].`;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
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
    if (typeof m.content !== "string") return null;
    const content = m.content.slice(0, MAX_MESSAGE_LENGTH);
    if (content.trim().length === 0) continue;
    total += content.length;
    if (total > MAX_TOTAL_LENGTH) return null;
    messages.push({ role: m.role, content });
  }
  return messages.length > 0 ? messages : null;
}

function parseKnownMemories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, MAX_MEMORY_LENGTH))
    .filter((item) => item.length > 0)
    .slice(0, 50);
}

function extractJsonArray(text: string): unknown[] | null {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
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
  }
  return "";
}

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
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

  const payload =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const messages = parseMessages(payload.messages);
  if (!messages) {
    return errorResponse(400, "Invalid conversation payload.");
  }
  const known = parseKnownMemories(payload.known);

  const transcript = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n")
    .slice(0, MAX_TOTAL_LENGTH);

  const knownBlock =
    known.length > 0
      ? `Known memories (do not repeat these):\n${known.map((k) => `- ${k}`).join("\n")}\n\n`
      : "";

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
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: `${knownBlock}Conversation transcript:\n\n${transcript}`,
          },
        ],
        temperature: 0,
        stream: false,
      }),
    });
  } catch {
    return errorResponse(
      502,
      "Could not reach the AI service while updating memory."
    );
  }

  if (!upstream.ok) {
    let detail = "";
    try {
      detail = extractDetail(await upstream.json());
    } catch {
      // Keep the generic message.
    }
    return errorResponse(
      502,
      detail
        ? `Memory extraction failed: ${detail}`
        : "Memory extraction failed. Please try again."
    );
  }

  let content = "";
  try {
    const data: unknown = await upstream.json();
    const choices = (data as Record<string, unknown>).choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const message = (choices[0] as Record<string, unknown>).message;
      if (
        typeof message === "object" &&
        message !== null &&
        typeof (message as Record<string, unknown>).content === "string"
      ) {
        content = (message as { content: string }).content;
      }
    }
  } catch {
    return errorResponse(502, "Memory extraction returned an invalid response.");
  }

  const array = extractJsonArray(content);
  if (array === null) {
    return NextResponse.json({ memories: [] });
  }

  const memories = array
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().replace(/\s+/g, " ").slice(0, MAX_MEMORY_LENGTH))
    .filter((item) => item.length > 0)
    .slice(0, MAX_EXTRACTED);

  return NextResponse.json({ memories });
}
