"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/types";
import { speak, stopSpeaking } from "@/lib/speech";
import {
  createRecognizer,
  speechRecognitionSupported,
  type Recognizer,
} from "@/lib/voice";
import { CloseIcon, MicIcon, SpeakerIcon, SparklesIcon } from "./icons";

type Phase = "listening" | "thinking" | "speaking";
type ChatStatus = "idle" | "loading" | "streaming";

const SEND_SILENCE_MS = 900;
const BUSY_RETRY_MS = 600;

const PHASE_UI: Record<Phase, { label: string; hint: string }> = {
  listening: {
    label: "Listening",
    hint: "Say something — I'll send it after you pause.",
  },
  thinking: {
    label: "Thinking",
    hint: "The AI is working on a reply…",
  },
  speaking: {
    label: "Speaking",
    hint: "Tap the orb to jump in, or just wait for it to finish.",
  },
};

interface LiveModeProps {
  open: boolean;
  onClose: () => void;
  onSend: (content: string) => void;
  onStop: () => void;
  status: ChatStatus;
  lastAssistant: Message | null;
  naturalVoice: string | null;
}

export function LiveMode({
  open,
  onClose,
  onSend,
  onStop,
  status,
  lastAssistant,
  naturalVoice,
}: LiveModeProps) {
  const [phase, setPhase] = useState<Phase>("listening");
  const [interim, setInterim] = useState("");
  const [heard, setHeard] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openRef = useRef(false);
  const statusRef = useRef(status);
  const phaseRef = useRef<Phase>("listening");
  const spokenIdRef = useRef<string | null>(null);
  const pendingRef = useRef("");
  const silenceTimerRef = useRef<number | null>(null);
  const recognizerRef = useRef<Recognizer | null>(null);
  const closeRef = useRef<() => void>(() => {});

  statusRef.current = status;

  const applyPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const startMic = useCallback(() => {
    recognizerRef.current?.start();
  }, []);

  const stopMic = useCallback(() => {
    recognizerRef.current?.stop();
  }, []);

  const resumeListening = useCallback(() => {
    if (!openRef.current) return;
    applyPhase("listening");
    startMic();
  }, [applyPhase, startMic]);

  const flushRef = useRef<() => void>(() => {});

  const handleFinalRef = useRef<(text: string) => void>(() => {});

  useEffect(() => {
    if (!open) return;
    openRef.current = true;
    stopSpeaking();
    pendingRef.current = "";
    spokenIdRef.current = lastAssistant && !lastAssistant.error ? lastAssistant.id : null;
    setInterim("");
    setHeard(null);
    setError(null);
    applyPhase("listening");

    if (!speechRecognitionSupported()) {
      setError(
        "This browser can't listen to you. Live voice needs Chrome or Edge — you can still read the AI's replies here."
      );
      return () => {
        openRef.current = false;
      };
    }

    const recognizer = createRecognizer({
      onFinal: (text) => handleFinalRef.current(text),
      onInterim: (text) => {
        if (openRef.current) setInterim(text);
      },
      onError: (message) => {
        if (openRef.current) setError(message);
      },
    });
    recognizerRef.current = recognizer;

    return () => {
      openRef.current = false;
      recognizer.stop();
      recognizerRef.current = null;
      if (silenceTimerRef.current !== null) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, applyPhase]);

  useEffect(() => {
    handleFinalRef.current = (text: string) => {
      if (!openRef.current || phaseRef.current === "speaking") return;
      pendingRef.current = `${pendingRef.current} ${text}`.trim();
      setInterim("");
      setHeard(pendingRef.current);
      if (silenceTimerRef.current !== null) {
        window.clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = window.setTimeout(
        () => flushRef.current(),
        SEND_SILENCE_MS
      );
    };
    flushRef.current = () => {
      if (!openRef.current) return;
      const text = pendingRef.current.trim();
      pendingRef.current = "";
      if (!text) return;
      if (statusRef.current !== "idle") {
        silenceTimerRef.current = window.setTimeout(
          () => flushRef.current(),
          BUSY_RETRY_MS
        );
        return;
      }
      setHeard(text);
      setInterim("");
      onSend(text);
    };
  }, [onSend]);

  useEffect(() => {
    if (!open || status === "idle") return;
    stopMic();
    applyPhase("thinking");
  }, [open, status, stopMic, applyPhase]);

  useEffect(() => {
    if (!open || status !== "idle") return;
    const last = lastAssistant;
    if (
      last &&
      !last.error &&
      last.content &&
      spokenIdRef.current !== last.id
    ) {
      spokenIdRef.current = last.id;
      applyPhase("speaking");
      stopMic();
      const started = speak(last.content, {
        naturalVoice,
        onEnd: resumeListening,
      });
      if (!started) resumeListening();
      return;
    }
    if (phaseRef.current === "speaking") return;
    applyPhase("listening");
    startMic();
  }, [
    open,
    status,
    lastAssistant,
    applyPhase,
    resumeListening,
    startMic,
    stopMic,
  ]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    closeRef.current = handleClose;
  }, [handleClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (phaseRef.current === "speaking") {
        stopSpeaking();
        return;
      }
      event.preventDefault();
      closeRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  const ui = PHASE_UI[phase];
  const OrbIcon =
    phase === "listening" ? MicIcon : phase === "thinking" ? SparklesIcon : SpeakerIcon;

  const handleOrbClick = () => {
    if (phase === "speaking") {
      stopSpeaking();
    } else if (phase === "listening" && error) {
      setError(null);
      startMic();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Live voice conversation"
      className="animate-fade-in fixed inset-0 z-50 flex flex-col items-center bg-slate-950/95 px-6 py-5 backdrop-blur-xl"
    >
      <div className="flex w-full max-w-3xl items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{
              backgroundColor: "var(--accent-badge-bg)",
              color: "var(--accent-text)",
            }}
          >
            <MicIcon width={15} height={15} />
          </span>
          <h2 className="text-sm font-semibold text-slate-200">Live voice</h2>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close live voice mode"
          className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-400"
        >
          <CloseIcon width={16} height={16} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 py-4">
        <button
          type="button"
          onClick={handleOrbClick}
          aria-label={
            phase === "speaking"
              ? "Interrupt the AI"
              : phase === "thinking"
                ? "The AI is thinking"
                : "Listening — tap to retry the microphone"
          }
          className="relative flex h-48 w-48 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-indigo-400"
        >
          {phase === "listening" && !error && (
            <>
              <span
                className="live-ring absolute inset-0 rounded-full border-2"
                style={{ borderColor: "var(--accent-border)" }}
              />
              <span
                className="live-ring absolute inset-0 rounded-full border-2"
                style={{
                  borderColor: "var(--accent-border)",
                  animationDelay: "0.9s",
                }}
              />
            </>
          )}
          <span
            className={`live-orb flex h-36 w-36 items-center justify-center rounded-full text-white ${
              phase === "thinking" ? "opacity-80" : ""
            }`}
            style={{
              background:
                "linear-gradient(140deg, var(--accent-soft), var(--accent))",
              boxShadow: "0 0 80px -12px var(--accent)",
            }}
          >
            <OrbIcon width={40} height={40} />
          </span>
        </button>

        <div className="text-center">
          <p
            aria-live="polite"
            className={`text-lg font-semibold ${
              phase === "thinking" ? "shimmer-text" : "text-slate-100"
            }`}
          >
            {ui.label}
            {phase === "listening" ? "…" : ""}
          </p>
          <p className="mt-1 text-xs text-slate-500">{ui.hint}</p>
        </div>

        {error && (
          <div className="flex flex-col items-center gap-2">
            <p
              role="alert"
              className="max-w-md rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-center text-xs text-red-300"
            >
              {error}
            </p>
            {speechRecognitionSupported() && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  startMic();
                }}
                className="text-xs font-medium text-slate-300 underline decoration-slate-600 underline-offset-4 hover:text-slate-100"
              >
                Try the microphone again
              </button>
            )}
          </div>
        )}

        <p
          aria-live="polite"
          className="min-h-[3.5rem] max-w-xl text-center text-base leading-relaxed text-slate-200"
        >
          {interim || heard || (phase === "listening" && !error ? "Say anything…" : "")}
        </p>

        {lastAssistant && lastAssistant.content && (
          <div className="max-h-36 w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm leading-relaxed text-slate-300">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Latest reply
            </p>
            <p className="whitespace-pre-wrap">{lastAssistant.content}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 pb-2">
        {status !== "idle" && (
          <button
            type="button"
            onClick={onStop}
            className="rounded-full border border-white/15 bg-slate-800/80 px-5 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-indigo-400"
          >
            Stop generating
          </button>
        )}
        <button
          type="button"
          onClick={handleClose}
          className="rounded-full border border-white/15 bg-slate-800/80 px-6 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-indigo-400"
        >
          End voice mode
        </button>
        <p className="text-[11px] text-slate-500">
          Voice recognition works best in Chrome or Edge.
        </p>
      </div>
    </div>
  );
}
