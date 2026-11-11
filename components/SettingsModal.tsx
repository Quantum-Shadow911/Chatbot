"use client";

import { useEffect, useRef } from "react";
import { ACCENT_PRESETS, DEFAULT_ACCENT, type Settings, type ThemeMode } from "@/lib/theme";
import {
  CheckIcon,
  CloseIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "./icons";

interface SettingsModalProps {
  settings: Settings;
  onThemeChange: (theme: ThemeMode) => void;
  onAccentChange: (accent: string | null) => void;
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
      </div>
    </div>
  );
}
