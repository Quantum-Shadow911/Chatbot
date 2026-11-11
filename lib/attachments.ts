import type { Attachment } from "@/lib/types";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_CHARS = 60_000;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 6;
const MAX_IMAGE_DIMENSION = 1280;

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "yaml", "yml", "toml", "xml",
  "html", "css", "scss", "js", "jsx", "mjs", "cjs", "ts", "tsx", "py", "rb",
  "go", "rs", "java", "kt", "c", "h", "cpp", "hpp", "cs", "php", "sh", "bash",
  "zsh", "sql", "r", "swift", "lua", "pl", "ini", "cfg", "conf", "env", "log",
  "diff", "patch", "dockerfile", "makefile", "gitignore",
]);

export class AttachmentError extends Error {}

function isTextLike(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  if (file.type === "application/json" || file.type === "application/xml" ||
    file.type === "application/javascript" || file.type === "application/x-yaml" ||
    file.type === "application/toml") {
    return true;
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.has(extension);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new AttachmentError(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function downscaleImage(file: File): Promise<string> {
  const dataUrl = await readAsDataUrl(file);
  if (typeof document === "undefined") return dataUrl;
  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new AttachmentError(`Could not decode ${file.name}.`));
  });
  image.src = dataUrl;
  await loaded;
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
  if (scale >= 1 && dataUrl.length < MAX_IMAGE_BYTES) return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const keepPng = file.type === "image/png" || file.type === "image/webp";
  return canvas.toDataURL(keepPng ? file.type : "image/jpeg", 0.85);
}

async function processFile(file: File): Promise<Attachment> {
  const base = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name || "attachment",
    mime: file.type || "application/octet-stream",
    size: file.size,
  };
  if (file.type.startsWith("image/")) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new AttachmentError(
        `${base.name} is larger than ${formatBytes(MAX_IMAGE_BYTES)}.`
      );
    }
    const dataUrl = await downscaleImage(file);
    return { ...base, kind: "image", dataUrl };
  }
  if (isTextLike(file)) {
    const raw = await file.text();
    const text =
      raw.length > MAX_TEXT_CHARS
        ? `${raw.slice(0, MAX_TEXT_CHARS)}\n[truncated]`
        : raw;
    return { ...base, kind: "text", text };
  }
  return { ...base, kind: "file" };
}

export async function processFiles(
  files: FileList | File[]
): Promise<{ attachments: Attachment[]; errors: string[] }> {
  const list = Array.from(files);
  const attachments: Attachment[] = [];
  const errors: string[] = [];
  let total = 0;
  for (const file of list) {
    if (attachments.length >= MAX_ATTACHMENTS) {
      errors.push(`At most ${MAX_ATTACHMENTS} files per message.`);
      break;
    }
    try {
      const attachment = await processFile(file);
      total += attachment.kind === "image" && attachment.dataUrl
        ? attachment.dataUrl.length * 0.75
        : attachment.size;
      if (total > MAX_TOTAL_BYTES) {
        errors.push(`Attachments for one message are limited to ${formatBytes(MAX_TOTAL_BYTES)}.`);
        break;
      }
      attachments.push(attachment);
    } catch (error) {
      errors.push(error instanceof AttachmentError ? error.message : `Could not read ${file.name}.`);
    }
  }
  return { attachments, errors };
}
