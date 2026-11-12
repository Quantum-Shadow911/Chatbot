"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "./icons";

interface ModelPickerProps {
  models: string[];
  selected: string;
  onSelect: (model: string) => void;
}

const TOKEN_FIXES: Record<string, string> = {
  gpt: "GPT",
  ai: "AI",
  oss: "OSS",
  llm: "LLM",
  vlm: "VLM",
  tts: "TTS",
  r1: "R1",
  v3: "V3",
  k2: "K2",
  "4b": "4B",
  "9b": "9B",
  "12b": "12B",
  "17b": "17B",
  "32b": "32B",
  "120b": "120B",
  "2409": "",
  "2407": "",
  "2501": "",
  "2503": "",
  "2505": "",
  "2507": "",
};

function displayName(model: string): string {
  const id = model.split("/").pop() ?? model;
  return id
    .split("-")
    .filter((part) => part !== "latest")
    .map((part) => TOKEN_FIXES[part] ?? part.charAt(0).toUpperCase() + part.slice(1))
    .filter(Boolean)
    .join(" ");
}

export function ModelPicker({ models, selected, onSelect }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select model"
        title="Select model"
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-slate-100"
      >
        <span className="max-w-[140px] truncate">{displayName(selected)}</span>
        <ChevronDownIcon width={12} height={12} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Available models"
          className="animate-drop-in absolute left-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-white/10 bg-slate-800 py-1 shadow-xl"
        >
          {models.map((model) => {
            const active = model === selected;
            return (
              <li key={model}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onSelect(model);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                    active
                      ? "text-indigo-200"
                      : "text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <span className="min-w-0 truncate">{displayName(model)}</span>
                  {active && <CheckIcon width={13} height={13} className="shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
