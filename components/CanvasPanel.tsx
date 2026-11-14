"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  canvasDownload,
  parseQuiz,
  type CanvasArtifact,
} from "@/lib/canvas";
import { trapTabKey } from "@/lib/focusTrap";
import { Markdown } from "./Markdown";
import { QuizView } from "./QuizView";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, RefreshIcon } from "./icons";

interface CanvasPanelProps {
  artifact: CanvasArtifact;
  streaming?: boolean;
  onClose: () => void;
}

function CanvasLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <span
        className="live-spin block h-14 w-14 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 5%, var(--accent) 30%, transparent 55%)",
        }}
      />
      <p className="shimmer-text text-sm font-semibold text-slate-300">{label}</p>
    </div>
  );
}

export function CanvasPanel({ artifact, streaming = false, onClose }: CanvasPanelProps) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const docRef = useRef<HTMLDivElement | null>(null);

  const isWeb = artifact.type === "html" || artifact.type === "video";
  const quiz = useMemo(
    () => (artifact.type === "quiz" ? parseQuiz(artifact.content) : null),
    [artifact]
  );

  useEffect(() => {
    setShowCode(false);
    setCopied(false);
    setReloadKey(0);
    panelRef.current?.focus();
  }, [artifact.id]);

  useEffect(() => {
    if (!streaming || artifact.type !== "document") return;
    const el = docRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [streaming, artifact.type, artifact.content]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      trapTabKey(panelRef.current, event);
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = () => {
    const file = canvasDownload(artifact);
    const blob = new Blob([file.body], { type: file.mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-40 sm:left-auto sm:w-[560px]">
      <button
        type="button"
        aria-label="Close canvas"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 hidden bg-slate-950/60 backdrop-blur-sm sm:block"
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="complementary"
        aria-label={`Canvas: ${artifact.title}`}
        className="animate-canvas-in absolute inset-0 flex flex-col border-l border-white/10 bg-slate-950/95 shadow-2xl shadow-black/60 backdrop-blur-xl outline-none sm:inset-y-0 sm:right-0"
      >
        <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold text-slate-100">{artifact.title}</h2>
          </div>
          {isWeb && (
            <>
              <div className="flex overflow-hidden rounded-lg border border-white/10 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setShowCode(false)}
                  aria-pressed={!showCode}
                  className={`px-2.5 py-1.5 transition-colors ${
                    !showCode
                      ? "bg-white/15 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setShowCode(true)}
                  aria-pressed={showCode}
                  className={`px-2.5 py-1.5 transition-colors ${
                    showCode
                      ? "bg-white/15 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Code
                </button>
              </div>
              {artifact.type === "video" && !showCode && (
                <button
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                  aria-label="Replay animation"
                  title="Replay"
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100"
                >
                  <RefreshIcon width={15} height={15} />
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy canvas content"
            title="Copy"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100"
          >
            {copied ? (
              <CheckIcon width={15} height={15} className="text-emerald-400" />
            ) : (
              <CopyIcon width={15} height={15} />
            )}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            aria-label="Download canvas"
            title="Download"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100"
          >
            <DownloadIcon width={15} height={15} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close canvas"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100"
          >
            <CloseIcon width={15} height={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden">
          {isWeb ? (
            streaming ? (
              <CanvasLoading
                label={
                  artifact.type === "video"
                    ? "Filming your animation…"
                    : "Building your canvas…"
                }
              />
            ) : showCode ? (
              <pre className="h-full overflow-auto whitespace-pre-wrap break-words px-4 py-4 text-[11px] leading-relaxed text-slate-300">
                <code>{artifact.content}</code>
              </pre>
            ) : (
              <iframe
                key={reloadKey}
                title={artifact.title}
                sandbox="allow-scripts"
                srcDoc={artifact.content}
                className="h-full w-full border-0 bg-slate-900"
              />
            )
          ) : artifact.type === "quiz" ? (
            <div className="h-full overflow-y-auto">
              {streaming ? (
                <CanvasLoading label="Writing your quiz…" />
              ) : quiz ? (
                <QuizView quiz={quiz} />
              ) : (
                <pre className="whitespace-pre-wrap break-words px-4 py-4 text-xs text-slate-300">
                  <code>{artifact.content}</code>
                </pre>
              )}
            </div>
          ) : (
            <div ref={docRef} className="h-full overflow-y-auto px-5 py-4">
              <Markdown content={artifact.content} />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
