export interface MemoryItem {
  id: string;
  text: string;
  createdAt: number;
}

export const MAX_MEMORIES = 50;
export const MAX_MEMORY_LENGTH = 200;

const MEMORY_KEY = "ai-chatbot:memory:v1";

function isMemoryItem(value: unknown): value is MemoryItem {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.text === "string" &&
    m.text.trim().length > 0 &&
    m.text.length <= MAX_MEMORY_LENGTH &&
    typeof m.createdAt === "number"
  );
}

export function loadMemories(): MemoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MEMORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMemoryItem);
  } catch {
    return [];
  }
}

export function saveMemories(memories: MemoryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEMORY_KEY, JSON.stringify(memories));
  } catch {
    // Storage may be unavailable (private mode); memory stays in memory only.
  }
}

function normalizeFact(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ").slice(0, MAX_MEMORY_LENGTH);
  return text.length > 0 ? text : null;
}

function similarity(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/\s+/));
  const tokensB = new Set(b.toLowerCase().split(/\s+/));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap += 1;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

const SIMILARITY_THRESHOLD = 0.6;

function isNearDuplicate(text: string, memories: MemoryItem[]): boolean {
  return memories.some(
    (memory) =>
      similarity(text, memory.text) >= SIMILARITY_THRESHOLD ||
      memory.text.toLowerCase().includes(text.toLowerCase()) ||
      text.toLowerCase().includes(memory.text.toLowerCase())
  );
}

export function mergeMemories(
  existing: MemoryItem[],
  incoming: unknown
): { memories: MemoryItem[]; added: string[] } {
  if (!Array.isArray(incoming)) return { memories: existing, added: [] };
  const known = new Set(
    existing.map((m) => m.text.toLowerCase().replace(/[.!]$/, ""))
  );
  const added: string[] = [];
  let memories = [...existing];
  for (const item of incoming) {
    const text = normalizeFact(item);
    if (!text) continue;
    const key = text.toLowerCase().replace(/[.!]$/, "");
    if (known.has(key) || isNearDuplicate(text, memories)) continue;
    known.add(key);
    added.push(text);
    memories.push({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      createdAt: Date.now(),
    });
  }
  if (memories.length > MAX_MEMORIES) {
    memories = memories.slice(memories.length - MAX_MEMORIES);
  }
  return { memories, added };
}
