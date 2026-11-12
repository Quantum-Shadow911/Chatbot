import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = (process.env.MISTRAL_API_URL ?? "https://api.mistral.ai")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/v1$/, "");
const MODEL = process.env.MISTRAL_MODEL ?? "mistral-small-latest";

const MAX_MESSAGES = 6;
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_TITLE_LENGTH = 60;

const TITLE_PROMPT = `You generate short, clear titles for chat conversations based on their first exchange.

Rules:
- Respond with ONLY the title text. No quotes, no markdown, no trailing punctuation.
- 2 to 6 words, describing the main topic.
- Examples:
  User: "What's one plus one?" -> "Simple math question"
  User: "Help me write an email to my boss asking for leave" -> "Leave request email"
  User: "Explain how neural networks learn" -> "How neural networks learn"
  User: "¿Cómo estoy hoy?" -> "Spanish greeting chat"
- Use the same language as the user's message.`;

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
    if (m.role !== "user" && m.role !== "assistant") return null;
    if (typeof m.content !== "string") return null;
    const content = m.content.slice(0, MAX_MESSAGE_LENGTH);
    if (content.trim().length === 0) continue;
    messages.push({ role: m.role, content });
  }
  return messages.length > 0 ? messages : null;
}

function cleanTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const title = raw
    .trim()
    .split("\n")[0]
    .replace(/^["'`\s]+|["'`\s.]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, MAX_TITLE_LENGTH)
    .trim();
  return title.length >= 2 ? title : null;
}

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return errorResponse(500, "The AI service is not configured.");
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
          { role: "system", content: TITLE_PROMPT },
          {
            role: "user",
            content: messages
              .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
              .join("\n\n"),
          },
        ],
        temperature: 0.3,
        stream: false,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return errorResponse(502, "Could not reach the AI service for a title.");
  }

  if (!upstream.ok) {
    return errorResponse(502, "Title generation failed.");
  }

  try {
    const data: unknown = await upstream.json();
    const choices = (data as Record<string, unknown>).choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      return NextResponse.json({ title: null });
    }
    const message = (choices[0] as Record<string, unknown>).message;
    const content =
      typeof message === "object" && message !== null
        ? (message as Record<string, unknown>).content
        : undefined;
    return NextResponse.json({ title: cleanTitle(content) });
  } catch {
    return NextResponse.json({ title: null });
  }
}
