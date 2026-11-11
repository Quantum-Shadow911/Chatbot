import type { Attachment, Conversation, Message } from "./types";
import { normalizeSettings, type Settings } from "./theme";

const STORAGE_KEY = "ai-chatbot:conversations:v1";
const ACTIVE_KEY = "ai-chatbot:active:v1";
const SETTINGS_KEY = "ai-chatbot:settings:v1";

function isAttachment(value: unknown): value is Attachment {
  if (typeof value !== "object" || value === null) return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    typeof a.name === "string" &&
    typeof a.mime === "string" &&
    typeof a.size === "number" &&
    (a.kind === "image" || a.kind === "text" || a.kind === "file") &&
    (a.dataUrl === undefined || typeof a.dataUrl === "string") &&
    (a.text === undefined || typeof a.text === "string")
  );
}

function isMessage(value: unknown): value is Message {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  if (
    typeof m.id !== "string" ||
    (m.role !== "user" && m.role !== "assistant") ||
    typeof m.content !== "string" ||
    typeof m.createdAt !== "number"
  ) {
    return false;
  }
  if (m.attachments !== undefined) {
    if (!Array.isArray(m.attachments) || !m.attachments.every(isAttachment)) {
      return false;
    }
  }
  return true;
}

function isConversation(value: unknown): value is Conversation {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.title === "string" &&
    Array.isArray(c.messages) &&
    c.messages.every(isMessage) &&
    typeof c.createdAt === "number" &&
    typeof c.updatedAt === "number"
  );
}

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isConversation);
  } catch {
    return [];
  }
}

function stripAttachmentData(conversations: Conversation[]): Conversation[] {
  return conversations.map((conversation) => ({
    ...conversation,
    messages: conversation.messages.map((message) =>
      message.attachments
        ? {
            ...message,
            attachments: message.attachments.map(
              ({ id, name, mime, size, kind }) => ({ id, name, mime, size, kind })
            ),
          }
        : message
    ),
  }));
}

export function saveConversations(conversations: Conversation[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // Attachment data can exceed the storage quota; keep metadata only.
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(stripAttachmentData(conversations))
      );
    } catch {
      // Storage may be unavailable (private mode); the app keeps working in memory.
    }
  }
}

export function loadActiveConversationId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveConversationId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id === null) window.localStorage.removeItem(ACTIVE_KEY);
    else window.localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // Ignore storage failures.
  }
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return { theme: "system", accent: null };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { theme: "system", accent: null };
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { theme: "system", accent: null };
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures.
  }
}
