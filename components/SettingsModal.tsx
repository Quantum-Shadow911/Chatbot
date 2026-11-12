"use client";

import { useEffect, useRef, useState } from "react";
import { ACCENT_PRESETS, DEFAULT_ACCENT, type Settings, type ThemeMode } from "@/lib/theme";
import type { MemoryItem } from "@/lib/memory";
import {
  listVoices,
  naturalTtsInfo,
  onVoicesChanged,
  speak,
  speechSupported,
  stopSpeaking,
  type NaturalTtsInfo,
  type VoiceOption,
} from "@/lib/speech";
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

interface DataControls {
  onExport: () => void;
  onExportPdf: () => void;
  canExportPdf: boolean;
  onDeleteAll: () => void;
  canDeleteAll: boolean;
  conversationCount: number;
}

interface SettingsModalProps {
  settings: Settings;
  onThemeChange: (theme: ThemeMode) => void;
  onAccentChange: (accent: string | null) => void;
  onReadAloudChange: (enabled: boolean) => void;
  onVoiceChange: (voice: string | null) => void;
  onVoiceRateChange: (rate: number) => void;
  onNaturalVoiceChange: (voice: string | null) => void;
  memory: MemorySettings;
  dataControls: DataControls;
  onClose: () => void;
}

type SettingsTab = "general" | "voice" | "memory" | "data";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "voice", label: "Voice" },
  { id: "memory", label: "Memory" },
  { id: "data", label: "Data controls" },
];

const THEME_OPTIONS: { value: ThemeMode; label: string; Icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
];

function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <h3
      id={id}
      className="text-xs font-semibold uppercase tracking-wide text-slate-400"
    >
      {children}
    </h3>
  );
}

export function SettingsModal({
  settings,
  onThemeChange,
  onAccentChange,
  onReadAloudChange,
  onVoiceChange,
  onVoiceRateChange,
  onNaturalVoiceChange,
  memory,
  dataControls,
  onClose,
}: SettingsModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<SettingsTab>("general");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [natural, setNatural] = useState<NaturalTtsInfo>({
    available: false,
    voices: [],
    default: null,
  });
  const supported = speechSupported();

  useEffect(() => {
    const refresh = () => setVoices(listVoices());
    refresh();
    return onVoicesChanged(refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void naturalTtsInfo().then((info) => {
      if (!cancelled) setNatural(info);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!confirmDelete) return;
    const timer = window.setTimeout(() => setConfirmDelete(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmDelete]);

  const activePreset = ACCENT_PRESETS.find(
    (preset) => preset.hex === (settings.accent ?? DEFAULT_ACCENT)
  );

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
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
        className="animate-pop-in relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl outline-none sm:flex-row"
      >
        <nav
          aria-label="Settings sections"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 bg-slate-900/60 p-2 sm:w-44 sm:flex-col sm:border-b-0 sm:border-r sm:p-3"
        >
          {TABS.map(({ id, label }) => {
            const selected = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(id)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  selected
                    ? "bg-indigo-500/20 text-indigo-200"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <div className="min-h-[320px] flex-1 overflow-y-auto p-5">
          {tab === "general" && (
            <>
              <section aria-labelledby="settings-theme-label">
                <SectionHeading id="settings-theme-label">Appearance</SectionHeading>
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
                <SectionHeading id="settings-accent-label">Accent color</SectionHeading>
                <div
                  className="mt-3 flex flex-wrap gap-2"
                  role="listbox"
                  aria-label="Accent color presets"
                >
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
                        {selected && (
                          <CheckIcon width={13} height={13} className="text-white drop-shadow" />
                        )}
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
                  {activePreset
                    ? `${activePreset.name} accent`
                    : `Custom accent ${settings.accent ?? ""}`}
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
            </>
          )}

          {tab === "voice" && (
            <section aria-labelledby="settings-voice-label">
              <SectionHeading id="settings-voice-label">Voice</SectionHeading>
              {!supported && !natural.available ? (
                <p className="mt-3 rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2.5 text-xs leading-relaxed text-slate-400">
                  Speech isn’t available right now. Try Chrome, Edge, or Safari.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    Have replies read aloud. Pick a voice and speed — press the
                    speaker button under any reply to hear it.
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-300">
                      Read replies aloud automatically
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.readAloud}
                      aria-label="Toggle read aloud"
                      onClick={() => onReadAloudChange(!settings.readAloud)}
                      className="relative h-5 w-9 shrink-0 rounded-full border border-white/10 transition-colors"
                      style={{
                        backgroundColor: settings.readAloud
                          ? "var(--accent)"
                          : "rgba(255, 255, 255, 0.12)",
                      }}
                    >
                      <span
                        aria-hidden
                        className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all"
                        style={{ left: settings.readAloud ? "1.25rem" : "0.125rem" }}
                      />
                    </button>
                  </div>

                  {natural.available && (
                    <div className="mt-5">
                      <label
                        htmlFor="settings-natural-voice-select"
                        className="text-xs font-medium text-slate-300"
                      >
                        Natural voice
                      </label>
                      <select
                        id="settings-natural-voice-select"
                        value={settings.naturalVoice ?? ""}
                        onChange={(event) =>
                          onNaturalVoiceChange(
                            event.target.value === "" ? null : event.target.value
                          )
                        }
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-slate-200 outline-none transition-all focus:border-indigo-400/60 focus:shadow-[0_0_0_3px_var(--accent-badge-bg)]"
                      >
                        <option value="">
                          Default
                          {natural.default
                            ? ` (${
                                natural.voices.find(
                                  (voice) => voice.id === natural.default
                                )?.name ?? natural.default
                              })`
                            : ""}
                        </option>
                        {natural.voices.map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Lifelike voices that sound like a real person. Used for
                        live mode and read-aloud whenever available.
                      </p>
                    </div>
                  )}

                  <div className="mt-5">
                    <label
                      htmlFor="settings-voice-select"
                      className="text-xs font-medium text-slate-300"
                    >
                      Browser voice (fallback)
                    </label>
                    <select
                      id="settings-voice-select"
                      value={settings.voice ?? ""}
                      onChange={(event) =>
                        onVoiceChange(event.target.value === "" ? null : event.target.value)
                      }
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-slate-200 outline-none transition-all focus:border-indigo-400/60 focus:shadow-[0_0_0_3px_var(--accent-badge-bg)]"
                    >
                      <option value="">Default voice</option>
                      {voices.map((voice) => (
                        <option key={voice.uri} value={voice.uri}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))}
                    </select>
                    {voices.length === 0 && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Loading voices…
                      </p>
                    )}
                  </div>

                  <div className="mt-5">
                    <label
                      htmlFor="settings-voice-rate"
                      className="text-xs font-medium text-slate-300"
                    >
                      Speed: {settings.voiceRate.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}×
                    </label>
                    <input
                      id="settings-voice-rate"
                      type="range"
                      min={0.5}
                      max={2}
                      step={0.05}
                      value={settings.voiceRate}
                      onChange={(event) => onVoiceRateChange(Number(event.target.value))}
                      className="mt-2 w-full accent-[var(--accent)]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      speak("Hey! This is how I will sound when I read replies aloud.", {
                        voiceURI: settings.voice,
                        naturalVoice: settings.naturalVoice,
                        rate: settings.voiceRate,
                      })
                    }
                    className="mt-5 rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 transition-all hover:border-white/20 hover:bg-slate-700/80"
                  >
                    Preview voice
                  </button>
                </>
              )}
            </section>
          )}

          {tab === "memory" && (
            <section aria-labelledby="settings-memory-label">
              <SectionHeading id="settings-memory-label">Memory</SectionHeading>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                The assistant saves important details you share — like your name,
                preferences, and projects — and uses them in every conversation.
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-xs text-slate-300">
                  <SparklesIcon
                    width={13}
                    height={13}
                    style={{ color: "var(--accent-text)" }}
                  />
                  Remember details across chats
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={memory.enabled}
                  aria-label="Toggle memory"
                  onClick={() => memory.onToggle(!memory.enabled)}
                  className="relative h-5 w-9 shrink-0 rounded-full border border-white/10 transition-colors"
                  style={{
                    backgroundColor: memory.enabled
                      ? "var(--accent)"
                      : "rgba(255, 255, 255, 0.12)",
                  }}
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
                      important details automatically.
                    </p>
                  ) : (
                    <>
                      <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
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
          )}

          {tab === "data" && (
            <section aria-labelledby="settings-data-label">
              <SectionHeading id="settings-data-label">Data controls</SectionHeading>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Your conversations and memories are stored only in this browser.
                Export them as a file, or delete everything.
              </p>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-800/60 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-200">Export data</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Download all conversations and memories as JSON.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dataControls.onExport}
                  className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
                >
                  Export
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-800/60 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-200">
                    Export current chat as PDF
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Open a printable copy of this conversation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dataControls.onExportPdf}
                  disabled={!dataControls.canExportPdf}
                  className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  PDF
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-950/20 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-200">Delete all chats</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Permanently remove{" "}
                    {dataControls.conversationCount === 1
                      ? "1 conversation"
                      : `${dataControls.conversationCount} conversations`}
                    . This cannot be undone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmDelete) {
                      dataControls.onDeleteAll();
                      setConfirmDelete(false);
                      onClose();
                    } else {
                      setConfirmDelete(true);
                    }
                  }}
                  disabled={!dataControls.canDeleteAll}
                  aria-label={
                    confirmDelete ? "Confirm delete all chats" : "Delete all chats"
                  }
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    confirmDelete
                      ? "bg-red-600 text-white hover:bg-red-500"
                      : "border border-red-500/40 text-red-300 hover:bg-red-500/10"
                  }`}
                >
                  {confirmDelete ? "Confirm delete" : "Delete all"}
                </button>
              </div>
            </section>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="absolute right-3 top-3 rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
        >
          <CloseIcon width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
