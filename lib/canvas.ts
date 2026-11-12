export type CanvasType = "document" | "quiz" | "html" | "video";

export interface CanvasArtifact {
  id: string;
  type: CanvasType;
  title: string;
  content: string;
}

export interface QuizQuestion {
  question: string;
  choices: string[];
  answer: number;
  explain?: string;
}

export interface QuizData {
  title?: string;
  questions: QuizQuestion[];
}

const OPEN_PATTERN = /^<<<CANVAS\s+(document|quiz|html|video)\s*\|\s*(.{1,120}?)\s*>>>$/;

const CANVAS_OPEN = "<<<CANVAS";
const CANVAS_CLOSE = "<<<END-CANVAS>>>";

export const CANVAS_TYPE_LABEL: Record<CanvasType, string> = {
  document: "Document",
  quiz: "Interactive quiz",
  html: "Interactive page",
  video: "Animated video",
};

export function hashText(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return `cv-${(hash >>> 0).toString(36)}`;
}

function parseCanvasBlock(block: string): CanvasArtifact | null {
  const newline = block.indexOf("\n");
  if (newline === -1) return null;
  const header = block.slice(0, newline).trim();
  const match = OPEN_PATTERN.exec(header);
  if (!match) return null;
  const content = block.slice(newline + 1).trim();
  if (!content) return null;
  const type = match[1] as CanvasType;
  const title = match[2].trim() || CANVAS_TYPE_LABEL[type];
  return {
    id: hashText(`${type}:${title}:${content.slice(0, 4000)}`),
    type,
    title,
    content,
  };
}

export type CanvasSegment =
  | { kind: "text"; text: string }
  | { kind: "canvas"; artifact: CanvasArtifact }
  | { kind: "canvas-pending" };

export function splitCanvasSegments(content: string): CanvasSegment[] {
  const segments: CanvasSegment[] = [];
  let rest = content;
  for (;;) {
    const open = rest.indexOf(CANVAS_OPEN);
    if (open === -1) {
      if (rest.length > 0) segments.push({ kind: "text", text: rest });
      break;
    }
    if (open > 0) segments.push({ kind: "text", text: rest.slice(0, open) });
    const close = rest.indexOf(CANVAS_CLOSE, open);
    if (close === -1) {
      segments.push({ kind: "canvas-pending" });
      break;
    }
    const artifact = parseCanvasBlock(rest.slice(open, close));
    if (artifact) {
      segments.push({ kind: "canvas", artifact });
    } else {
      segments.push({ kind: "text", text: rest.slice(open, close + CANVAS_CLOSE.length) });
    }
    rest = rest.slice(close + CANVAS_CLOSE.length);
  }
  return segments;
}

export function stripCanvasBlocks(text: string): string {
  return text
    .replace(/<<<CANVAS[^\n]*\n[\s\S]*?<<<END-CANVAS>>>/g, "")
    .replace(/<<<CANVAS[\s\S]*$/, "")
    .trim();
}

export function findLastCanvas(content: string): CanvasArtifact | null {
  const segments = splitCanvasSegments(content);
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i];
    if (segment.kind === "canvas") return segment.artifact;
    if (segment.kind === "canvas-pending") return null;
  }
  return null;
}

export function parseQuiz(content: string): QuizData | null {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      data = JSON.parse(content.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  if (typeof data !== "object" || data === null) return null;
  const raw = data as Record<string, unknown>;
  if (!Array.isArray(raw.questions) || raw.questions.length === 0) return null;
  const questions: QuizQuestion[] = [];
  for (const item of raw.questions) {
    if (typeof item !== "object" || item === null) return null;
    const q = item as Record<string, unknown>;
    if (typeof q.question !== "string" || !q.question.trim()) return null;
    if (!Array.isArray(q.choices) || q.choices.length < 2) return null;
    const choices = q.choices.filter(
      (choice): choice is string => typeof choice === "string"
    );
    if (choices.length !== q.choices.length) return null;
    const answer = q.answer;
    if (typeof answer !== "number" || !Number.isInteger(answer)) return null;
    if (answer < 0 || answer >= choices.length) return null;
    questions.push({
      question: q.question,
      choices,
      answer,
      explain: typeof q.explain === "string" ? q.explain : undefined,
    });
  }
  const title = typeof raw.title === "string" ? raw.title : undefined;
  return { title, questions };
}

export function canvasDownload(
  artifact: CanvasArtifact
): { filename: string; mime: string; body: string } {
  const safe = artifact.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "canvas";
  if (artifact.type === "html" || artifact.type === "video") {
    return { filename: `${safe}.html`, mime: "text/html", body: artifact.content };
  }
  if (artifact.type === "quiz") {
    return { filename: `${safe}.json`, mime: "application/json", body: artifact.content };
  }
  return { filename: `${safe}.md`, mime: "text/markdown", body: artifact.content };
}
