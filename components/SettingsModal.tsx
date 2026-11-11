"use client";

import { useEffect, useRef } from "react";
import { ACCENT_PRESETS, DEFAULT_ACCENT, type Settings, type ThemeMode } from "@/lib/theme";
import type { MemoryItem } from "@/lib/memory";
import {
  CheckIcon,
  CloseIcon,
  MonitorIcon,
  MoonIcon,
  SparklesIcon,
  SunIcon,
  TrashIcon,
} from "./icons";

interface MemorySettings {
  enabled: boolean;
  items: MemoryItem[];
  onToggle: (enabled: boolean) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

interface SettingsModalProps {
  settings: Settings;
  onThemeChange: (theme: ThemeMode) => void;
  onAccentChange: (accent: string | null) => void;
  memory: MemorySettings;
  onClose: () => void;
}

const THEME_OPTIONS: { value: ThemeMode; label: string; Icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
];

export function SettingsModal({
  settings,
  onThemeChange,
  onAccentChange,
  memory,
  onClose,
}: SettingsModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const activePreset = ACCENT_PRESETS.find(
    (preset) => preset.hex === (settings.accent ?? DEFAULT_ACCENT)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        <section className="mt-5" aria-labelledby="settings-theme-label">
          <h3 id="settings-theme-label" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Appearance
          </h3>
          <div
            role="radiogroup"
            aria-labelledby="settings-theme-label"
            className="mt-2 grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-slate-800/80 p-1"
          >
            {THEME_OPTIONS.map(({ value, label, Icon }) => {
              const selected = settings.theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onThemeChange(value)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                    selected
                      ? "bg-indigo-500 text-white shadow-sm"
                      : "text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <Icon width={14} height={14} />
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5" aria-labelledby="settings-accent-label">
          <h3 id="settings-accent-label" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Accent color
          </h3>
          <div className="mt-3 flex flex-wrap gap-2" role="listbox" aria-label="Accent color presets">
            {ACCENT_PRESETS.map((preset) => {
              const selected = preset.hex === (settings.accent ?? DEFAULT_ACCENT);
              return (
                <button
                  key={preset.hex}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={`${preset.name} accent`}
                  title={preset.name}
                  onClick={() => onAccentChange(preset.hex)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 transition-transform hover:scale-110"
                  style={{ backgroundColor: preset.hex }}
                >
                  {selected && <CheckIcon width={13} height={13} className="text-white drop-shadow" />}
                </button>
              );
            })}
            <label
              title="Custom color"
              className="flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-white/30 transition-transform hover:scale-110"
            >
              <span
                aria-hidden
                className="h-5 w-5 rounded-full"
                style={{
                  background:
                    "conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #6366f1, #ec4899, #ef4444)",
                }}
              />
              <input
                type="color"
                aria-label="Custom accent color"
                value={settings.accent ?? DEFAULT_ACCENT}
                onChange={(event) => onAccentChange(event.target.value)}
                className="sr-only"
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {activePreset ? `${activePreset.name} accent` : `Custom accent ${settings.accent ?? ""}`}
          </p>
          {settings.accent !== null && (
            <button
              type="button"
              onClick={() => onAccentChange(null)}
              className="mt-2 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/10"
            >
              Reset to default
            </button>
          )}
        </section>

        <section className="mt-5" aria-labelledby="settings-memory-label">
          <h3 id="settings-memory-label" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Memory
          </h3>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs text-slate-300">
              <SparklesIcon width={13} height={13} style={{ color: "var(--accent-text)" }} />
              Remember details across chats
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={memory.enabled}
              aria-label="Toggle memory"
              onClick={() => memory.onToggle(!memory.enabled)}
              className="relative h-5 w-9 shrink-0 rounded-full border border-white/10 transition-colors"
              style={{ backgroundColor: memory.enabled ? "var(--accent)" : "rgba(255, 255, 255, 0.12)" }}
            >
              <span
                aria-hidden
                className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all"
                style={{ left: memory.enabled ? "1.25rem" : "0.125rem" }}
              />
            </button>
          </div>
          {memory.enabled && (
            <div className="mt-3">
              {memory.items.length === 0 ? (
                <p className="rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
                  Nothing saved yet. As you chat, the assistant will remember
                  important details like your name, preferences, and projects.
                </p>
              ) : (
                <>
                  <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                    {memory.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-slate-800/60 px-2.5 py-1.5"
                      >
                        <span className="min-w-0 break-words text-[11px] leading-relaxed text-slate-300">
                          {item.text}
                        </span>
                        <button
                          type="button"
                          onClick={() => memory.onRemove(item.id)}
                          aria-label={`Forget: ${item.text}`}
                          title="Forget"
                          className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-slate-200"
                        >
                          <TrashIcon width={12} height={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={memory.onClear}
                    className="mt-2 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/10"
                  >
                    Clear all memories
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
