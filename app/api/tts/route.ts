import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTS_MODEL = "playai-tts";
const TTS_API_URL = (
  process.env.TTS_API_URL ??
  process.env.MISTRAL_API_URL ??
  ""
).trim();
const TTS_API_KEY = (
  process.env.TTS_API_KEY ??
  process.env.MISTRAL_API_KEY ??
  ""
).trim();
const MAX_TTS_LENGTH = 10_000;
const DEFAULT_VOICE = "Celeste-PlayAI";

const VOICES: { id: string; name: string }[] = [
  { id: "Arista-PlayAI", name: "Arista — bright, female" },
  { id: "Atlas-PlayAI", name: "Atlas — deep, male" },
  { id: "Basil-PlayAI", name: "Basil — warm, male" },
  { id: "Briggs-PlayAI", name: "Briggs — deep, male" },
  { id: "Celeste-PlayAI", name: "Celeste — warm, female" },
  { id: "Cheyenne-PlayAI", name: "Cheyenne — bright, female" },
  { id: "Chip-PlayAI", name: "Chip — cheerful, male" },
  { id: "Cillian-PlayAI", name: "Cillian — calm, male" },
  { id: "Deedee-PlayAI", name: "Deedee — playful, female" },
  { id: "Fritz-PlayAI", name: "Fritz — quirky, male" },
  { id: "Gail-PlayAI", name: "Gail — clear, female" },
  { id: "Indigo-PlayAI", name: "Indigo — smooth, neutral" },
  { id: "Mamaw-PlayAI", name: "Mamaw — grandmother" },
  { id: "Mason-PlayAI", name: "Mason — deep, male" },
  { id: "Mikail-PlayAI", name: "Mikail — smooth, male" },
  { id: "Mitch-PlayAI", name: "Mitch — casual, male" },
  { id: "Quinn-PlayAI", name: "Quinn — friendly, male" },
  { id: "Thunder-PlayAI", name: "Thunder — bold, male" },
];

const VOICE_IDS = new Set(VOICES.map((voice) => voice.id));

function speechUrl(raw: string): string {
  const base = raw.replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
  if (/\/v\d+$/.test(base)) return `${base}/audio/speech`;
  return `${base}/v1/audio/speech`;
}

export async function GET() {
  return NextResponse.json(
    {
      available: Boolean(TTS_API_URL && TTS_API_KEY),
      model: TTS_MODEL,
      voices: VOICES,
      default: DEFAULT_VOICE,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  if (!TTS_API_URL || !TTS_API_KEY) {
    return NextResponse.json(
      { error: "Text-to-speech is not configured on the server." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawText =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).text
      : undefined;
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Nothing to speak." }, { status: 400 });
  }
  if (text.length > MAX_TTS_LENGTH) {
    return NextResponse.json(
      { error: "Text is too long to speak." },
      { status: 400 }
    );
  }

  const rawVoice =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).voice
      : undefined;
  const requestedVoice =
    typeof rawVoice === "string" ? rawVoice.trim().slice(0, 64) : "";
  const voice = VOICE_IDS.has(requestedVoice) ? requestedVoice : DEFAULT_VOICE;

  let upstream: Response;
  try {
    upstream = await fetch(speechUrl(TTS_API_URL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TTS_API_KEY}`,
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        input: text,
        voice,
        response_format: "mp3",
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the text-to-speech service." },
      { status: 502 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    let detail = "";
    try {
      detail = (await upstream.text()).slice(0, 300);
    } catch {
      // Keep the generic message when the error body is unreadable.
    }
    return NextResponse.json(
      {
        error: detail
          ? `Text-to-speech failed (${upstream.status}): ${detail}`
          : `Text-to-speech failed (${upstream.status}).`,
      },
      { status: upstream.status === 400 ? 400 : 502 }
    );
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
