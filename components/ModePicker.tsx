"use client";

import { useEffect, useRef, useState } from "react";
import { MODES, type Mode } from "@/lib/modes";
import { CheckIcon, ChevronDownIcon } from "./icons";

interface ModePickerProps {
  selected: string | null;
  onSelect: (mode: string | null) => void;
}

const CATEGORY_LABELS: Record<Mode["category"], string> = {
  reasoning: "Reasoning",
  specialty: "Specialties",
};

export function ModePicker({ selected, onSelect }: ModePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const current = MODES.find((mode) => mode.id === selected) ?? MODES[0];

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

  const categories: Mode["category"][] = ["reasoning", "specialty"];

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select chat mode"
        title="Select chat mode"
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-slate-100"
      >
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "var(--accent)" }}
        />
        <span className="max-w-[110px] truncate">{current.label}</span>
        <ChevronDownIcon width={12} height={12} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Chat modes"
          className="animate-drop-in absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-white/10 bg-slate-800 py-1 shadow-xl"
        >
          {categories.map((category, index) => (
            <li key={category}>
              <p
                aria-hidden
                className={`px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ${
                  index === 0 ? "pt-1.5" : ""
                }`}
              >
                {CATEGORY_LABELS[category]}
              </p>
              {MODES.filter((mode) => mode.category === category).map((mode) => {
                const active = mode.id === current.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onSelect(mode.id === "auto" ? null : mode.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left transition-colors ${
                      active ? "text-indigo-200" : "text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-medium">{mode.label}</span>
                      <span className="block text-[11px] leading-snug text-slate-500">
                        {mode.description}
                      </span>
                    </span>
                    {active && <CheckIcon width={13} height={13} className="mt-0.5 shrink-0" />}
                  </button>
                );
              })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
