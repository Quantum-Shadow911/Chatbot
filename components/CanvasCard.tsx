"use client";

import { memo } from "react";
import { type CanvasArtifact } from "@/lib/canvas";
import { FileIcon, SparklesIcon, WaveformIcon } from "./icons";

const TYPE_ICON = {
  document: FileIcon,
  quiz: SparklesIcon,
  html: SparklesIcon,
  video: WaveformIcon,
} as const;

interface CanvasCardProps {
  artifact: CanvasArtifact;
  onOpen: (artifact: CanvasArtifact) => void;
}

export const CanvasCard = memo(function CanvasCard({
  artifact,
  onOpen,
}: CanvasCardProps) {
  const Icon = TYPE_ICON[artifact.type];
  return (
    <button
      type="button"
      onClick={() => onOpen(artifact)}
      className="animate-pop-in group mt-1 flex w-full max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-14px_var(--accent-border)] focus-visible:outline-2 focus-visible:outline-indigo-400 active:scale-[0.99]"
      style={{
        borderColor: "var(--accent-border)",
        background:
          "linear-gradient(120deg, var(--accent-badge-bg), rgba(15, 23, 42, 0.85))",
      }}
      aria-label={`Open canvas: ${artifact.title}`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
        style={{
          background: "linear-gradient(135deg, var(--accent-soft), var(--accent))",
          boxShadow: "0 6px 18px -6px var(--accent)",
        }}
      >
        <Icon width={17} height={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-100">
          {artifact.title}
        </span>
      </span>
      <span
        className="shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition-transform group-hover:scale-105"
        style={{ borderColor: "var(--accent-border)", color: "var(--accent-text)" }}
      >
        Open
      </span>
    </button>
  );
});

interface CanvasPendingCardProps {
  artifact: CanvasArtifact;
  onOpen: (artifact: CanvasArtifact) => void;
}

export function CanvasPendingCard({ artifact, onOpen }: CanvasPendingCardProps) {
  const Icon = TYPE_ICON[artifact.type];
  return (
    <button
      type="button"
      onClick={() => onOpen(artifact)}
      className="mt-1 flex w-full max-w-sm cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-slate-800/70 focus-visible:outline-2 focus-visible:outline-indigo-400 active:scale-[0.99]"
      aria-label={`Open canvas while it is being created: ${artifact.title}`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
        style={{
          background: "linear-gradient(135deg, var(--accent-soft), var(--accent))",
        }}
      >
        <Icon width={17} height={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="shimmer-text block truncate text-sm font-semibold text-slate-300">
          Creating {artifact.title}…
        </span>
      </span>
      <span
        className="shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold"
        style={{ borderColor: "var(--accent-border)", color: "var(--accent-text)" }}
      >
        Open
      </span>
    </button>
  );
}
