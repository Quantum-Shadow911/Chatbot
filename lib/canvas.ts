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

const BLOCK_PATTERN =
  /<<<\s*CANVAS\s*[:\-\s]*\s*(document|quiz|html|video)\s*\|\s*([^\n]{1,120}?)\s*>>>\n?([\s\S]*?)<<<\s*END[\s-]?CANVAS\s*>>>/gi;

const FENCE_PATTERN = /```[a-zA-Z0-9_-]*[ \t]*\n([\s\S]*?)```/g;

const PENDING_PATTERN = /<<<\s*CANVAS/i;

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

function unwrapFence(content: string): string {
  const trimmed = content.trim();
  const match = /^```[a-zA-Z0-9_-]*[ \t]*\n([\s\S]*?)\n?```$/.exec(trimmed);
  return (match ? match[1] : trimmed).trim();
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
    let answer = q.answer as number | string | undefined;
    if (typeof answer === "string") {
      const index = choices.findIndex(
        (choice) => choice.trim().toLowerCase() === (answer as string).trim().toLowerCase()
      );
      if (index === -1) return null;
      answer = index;
    }
    if (typeof answer !== "number" || !Number.isInteger(answer)) return null;
    if (answer >= choices.length && answer - 1 >= 0 && answer - 1 < choices.length) {
      answer -= 1;
    }
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

function quizArtifact(content: string): CanvasArtifact | null {
  const quiz = parseQuiz(content);
  if (!quiz) return null;
  const body = content.trim();
  const title = quiz.title?.trim() || "Quiz";
  return {
    id: hashText(`quiz:${title}:${body.slice(0, 4000)}`),
    type: "quiz",
    title,
    content: body,
  };
}

function pushText(segments: CanvasSegment[], text: string) {
  if (!text) return;
  let last = 0;
  FENCE_PATTERN.lastIndex = 0;
  for (let m = FENCE_PATTERN.exec(text); m !== null; m = FENCE_PATTERN.exec(text)) {
    const artifact = quizArtifact(m[1]);
    if (artifact) {
      if (m.index > last) segments.push({ kind: "text", text: text.slice(last, m.index) });
      segments.push({ kind: "canvas", artifact });
    } else {
      segments.push({ kind: "text", text: text.slice(last, m.index + m[0].length) });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
}

export type CanvasSegment =
  | { kind: "text"; text: string }
  | { kind: "canvas"; artifact: CanvasArtifact }
  | { kind: "canvas-pending" };

export function splitCanvasSegments(content: string): CanvasSegment[] {
  const segments: CanvasSegment[] = [];
  let last = 0;
  BLOCK_PATTERN.lastIndex = 0;
  for (
    let m = BLOCK_PATTERN.exec(content);
    m !== null;
    m = BLOCK_PATTERN.exec(content)
  ) {
    if (m.index > last) pushText(segments, content.slice(last, m.index));
    const type = m[1].toLowerCase() as CanvasType;
    const title = m[2].trim() || CANVAS_TYPE_LABEL[type];
    const body = unwrapFence(m[3]);
    if (body) {
      segments.push({
        kind: "canvas",
        artifact: {
          id: hashText(`${type}:${title}:${body.slice(0, 4000)}`),
          type,
          title,
          content: body,
        },
      });
    } else {
      segments.push({ kind: "text", text: m[0] });
    }
    last = m.index + m[0].length;
  }
  const rest = content.slice(last);
  const pending = PENDING_PATTERN.exec(rest);
  if (pending) {
    if (pending.index > 0) pushText(segments, rest.slice(0, pending.index));
    segments.push({ kind: "canvas-pending" });
  } else {
    pushText(segments, rest);
  }
  return segments;
}

export function stripCanvasBlocks(text: string): string {
  return text
    .replace(BLOCK_PATTERN, "")
    .replace(/<<<\s*CANVAS[\s\S]*$/i, "")
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

export interface CanvasStream {
  artifact: CanvasArtifact;
  complete: boolean;
}

const HEADER_PATTERN =
  /<<<\s*CANVAS\s*[:\-\s]*\s*(document|quiz|html|video)\s*\|\s*([^\n]{0,120}?)(?:\s*>>>)?$/i;

const TYPE_ONLY_PATTERN = /<<<\s*CANVAS\s*[:\-\s]*\s*(document|quiz|html|video)/i;

const TRAILING_CLOSE_PATTERN = /<<<\s*END[\s-]?CANVAS\s*>*>?\s*$/i;

export function findCanvasStream(content: string): CanvasStream | null {
  const segments = splitCanvasSegments(content);
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i];
    if (segment.kind === "canvas") {
      return { artifact: segment.artifact, complete: true };
    }
    if (segment.kind === "canvas-pending") break;
  }
  const opens = [...content.matchAll(/<<<\s*CANVAS/gi)];
  if (opens.length === 0) return null;
  const afterOpen = content.slice(opens[opens.length - 1].index);
  const newline = afterOpen.indexOf("\n");
  const header = (newline === -1 ? afterOpen : afterOpen.slice(0, newline)).trim();
  const headerMatch = HEADER_PATTERN.exec(header);
  if (!headerMatch) {
    const typeMatch = TYPE_ONLY_PATTERN.exec(header);
    if (!typeMatch) return null;
    const type = typeMatch[1].toLowerCase() as CanvasType;
    return {
      artifact: {
        id: hashText(`pending:${type}`),
        type,
        title: CANVAS_TYPE_LABEL[type],
        content: "",
      },
      complete: false,
    };
  }
  const type = headerMatch[1].toLowerCase() as CanvasType;
  const title = headerMatch[2].trim() || CANVAS_TYPE_LABEL[type];
  const partial =
    newline === -1 ? "" : afterOpen.slice(newline + 1).replace(TRAILING_CLOSE_PATTERN, "");
  return {
    artifact: {
      id: hashText(`pending:${type}`),
      type,
      title,
      content: partial.trim(),
    },
    complete: false,
  };
}

export function canvasDownload(
  artifact: CanvasArtifact
): { filename: string; mime: string; body: string } {
  const safe =
    artifact.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) ||
    "canvas";
  if (artifact.type === "html" || artifact.type === "video") {
    return { filename: `${safe}.html`, mime: "text/html", body: artifact.content };
  }
  if (artifact.type === "quiz") {
    return { filename: `${safe}.json`, mime: "application/json", body: artifact.content };
  }
  return { filename: `${safe}.md`, mime: "text/markdown", body: artifact.content };
}
