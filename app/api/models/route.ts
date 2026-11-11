import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL = process.env.MISTRAL_MODEL ?? "mistral-small-latest";

function availableModels(): string[] {
  const extra = (process.env.MISTRAL_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter((model) => model.length > 0 && model.length <= 100);
  return Array.from(new Set([DEFAULT_MODEL, ...extra]));
}

export async function GET() {
  return NextResponse.json({
    models: availableModels(),
    default: DEFAULT_MODEL,
  });
}
