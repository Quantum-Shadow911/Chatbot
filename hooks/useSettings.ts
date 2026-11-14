"use client";

import { useCallback, useEffect, useState } from "react";
import { loadSettings, saveSettings } from "@/lib/storage";
import { applyTheme, DEFAULT_SETTINGS, type Settings, type ThemeMode } from "@/lib/theme";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyTheme(settings);
    saveSettings(settings);
  }, [settings, hydrated]);

  useEffect(() => {
    if (settings.theme !== "system" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme(settings);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [settings]);

  const setTheme = useCallback((theme: ThemeMode) => {
    setSettings((current) => ({ ...current, theme }));
  }, []);

  const setAccent = useCallback((accent: string | null) => {
    setSettings((current) => ({ ...current, accent }));
  }, []);

  const setMemoryEnabled = useCallback((memoryEnabled: boolean) => {
    setSettings((current) => ({ ...current, memoryEnabled }));
  }, []);

  const setModel = useCallback((model: string | null) => {
    setSettings((current) => ({ ...current, model }));
  }, []);

  const setReadAloud = useCallback((readAloud: boolean) => {
    setSettings((current) => ({ ...current, readAloud }));
  }, []);

  const setNaturalVoice = useCallback((naturalVoice: string | null) => {
    setSettings((current) => ({ ...current, naturalVoice }));
  }, []);

  const setChatMode = useCallback((mode: string | null) => {
    setSettings((current) => ({
      ...current,
      mode,
      mode2: current.mode2 && current.mode2 === mode ? null : current.mode2,
    }));
  }, []);

  const setChatMode2 = useCallback((mode2: string | null) => {
    setSettings((current) => ({
      ...current,
      mode2: mode2 && mode2 !== current.mode ? mode2 : null,
    }));
  }, []);

  return {
    settings,
    hydrated,
    setTheme,
    setAccent,
    setMemoryEnabled,
    setModel,
    setReadAloud,
    setNaturalVoice,
    setChatMode,
    setChatMode2,
  };
}
