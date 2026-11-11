"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadMemories,
  mergeMemories,
  saveMemories,
  type MemoryItem,
} from "@/lib/memory";

export function useMemory() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMemories(loadMemories());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveMemories(memories);
  }, [memories, hydrated]);

  const addMemories = useCallback((facts: string[]) => {
    setMemories((current) => mergeMemories(current, facts).memories);
  }, []);

  const removeMemory = useCallback((id: string) => {
    setMemories((current) => current.filter((m) => m.id !== id));
  }, []);

  const clearMemories = useCallback(() => {
    setMemories([]);
  }, []);

  return { memories, hydrated, addMemories, removeMemory, clearMemories };
}
