import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTS_MODEL = "canopylabs/orpheus-v1-english";
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
const DEFAULT_VOICE = "hannah";

const VOICES: { id: string; name: string }[] = [
  { id: "hannah", name: "Hannah — warm, female" },
  { id: "autumn", name: "Autumn — bright, female" },
  { id: "diana", name: "Diana — expressive, female" },
  { id: "austin", name: "Austin — casual, male" },
  { id: "daniel", name: "Daniel — deep, male" },
  { id: "troy", name: "Troy — confident, male" },
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
      available: true,
      groqReady: Boolean(TTS_API_URL && TTS_API_KEY),
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

  if (TTS_API_URL && TTS_API_KEY) {
    try {
      const upstream = await fetch(speechUrl(TTS_API_URL), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TTS_API_KEY}`,
        },
        body: JSON.stringify({
          model: TTS_MODEL,
          input: text,
          voice,
          response_format: "wav",
        }),
      });
      if (upstream.ok && upstream.body) {
        return new NextResponse(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "audio/wav",
            "Cache-Control": "no-store",
          },
        });
      }
    } catch {
      // Fall through to the built-in fallback voice.
    }
  }

  const fallback = await googleTtsResponse(text);
  if (fallback) return fallback;
  return NextResponse.json(
    { error: "Could not generate speech right now. Try again." },
    { status: 502 }
  );
}

const GTTS_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Referer: "https://translate.google.com/",
};
const GTTS_CHUNK_LENGTH = 180;
const GTTS_MAX_CHUNKS = 16;

function splitSpeechChunks(text: string, max: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > max) {
      if (current) chunks.push(current);
      current = word.slice(0, max);
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, GTTS_MAX_CHUNKS);
}

async function fetchGoogleChunk(chunk: string): Promise<Uint8Array | null> {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&ttsspeed=1&q=${encodeURIComponent(chunk)}`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { headers: GTTS_HEADERS });
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > 0) return new Uint8Array(buffer);
      }
    } catch {
      // Retry once, then give up.
    }
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  return null;
}

async function googleTtsResponse(text: string): Promise<NextResponse | null> {
  const chunks = splitSpeechChunks(text, GTTS_CHUNK_LENGTH);
  if (chunks.length === 0) return null;
  const parts: Uint8Array[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const audio = await fetchGoogleChunk(chunks[i]);
    if (!audio) return null;
    parts.push(audio);
    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }
  return new NextResponse(merged, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
