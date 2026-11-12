"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/types";
import { speak, stopSpeaking } from "@/lib/speech";
import {
  createMicMeter,
  createRecognizer,
  speechRecognitionSupported,
  type MicMeter,
  type Recognizer,
} from "@/lib/voice";
import { trapTabKey } from "@/lib/focusTrap";
import { CloseIcon, MicIcon, SpeakerIcon, SparklesIcon, WaveformIcon } from "./icons";

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
    hint: "Talk anytime — I'll catch it.",
  },
  speaking: {
    label: "Speaking",
    hint: "Just start talking to interrupt — or tap the orb.",
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
  const onStopRef = useRef(onStop);
  const phaseRef = useRef<Phase>("listening");
  const spokenIdRef = useRef<string | null>(null);
  const pendingRef = useRef("");
  const silenceTimerRef = useRef<number | null>(null);
  const recognizerRef = useRef<Recognizer | null>(null);
  const closeRef = useRef<() => void>(() => {});
  const orbRef = useRef<HTMLSpanElement | null>(null);
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const meterRef = useRef<MicMeter | null>(null);
  const speakStartRef = useRef(0);
  const onLevelRef = useRef<(level: number) => void>(() => {});
  const dialogRef = useRef<HTMLDivElement | null>(null);

  onLevelRef.current = (level: number) => {
    const orb = orbRef.current;
    if (orb && phaseRef.current === "listening") {
      orb.style.transform = `scale(${1 + level * 0.22})`;
      orb.style.boxShadow = `0 0 ${60 + level * 80}px ${level * 18}px var(--accent), inset 0 2px 20px rgba(255, 255, 255, 0.35)`;
    }
    barsRef.current.forEach((bar, index) => {
      if (!bar || phaseRef.current !== "listening") return;
      const wave =
        0.3 + level * (1.4 + 0.35 * Math.sin(Date.now() / 90 + index * 1.3));
      bar.style.transform = `scaleY(${Math.min(1, wave)})`;
    });
  };

  statusRef.current = status;

  const applyPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const startMic = useCallback(() => {
    recognizerRef.current?.start();
  }, []);

  const resumeListening = useCallback(() => {
    if (!openRef.current) return;
    applyPhase("listening");
    startMic();
  }, [applyPhase, startMic]);

  useEffect(() => {
    if (phase === "listening") return;
    const orb = orbRef.current;
    if (orb) {
      orb.style.transform = "";
      orb.style.boxShadow =
        "0 0 90px -10px var(--accent), inset 0 2px 20px rgba(255, 255, 255, 0.35)";
    }
    barsRef.current.forEach((bar) => {
      if (bar) bar.style.transform = "";
    });
  }, [phase]);

  const flushRef = useRef<() => void>(() => {});

  const handleFinalRef = useRef<(text: string) => void>(() => {});
  const handleInterimRef = useRef<(text: string) => void>(() => {});

  onStopRef.current = onStop;

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
      onInterim: (text) => handleInterimRef.current(text),
      onError: (message) => {
        if (openRef.current) setError(message);
      },
    });
    recognizerRef.current = recognizer;
    recognizer.start();

    const meter = createMicMeter((level) => onLevelRef.current(level));
    meterRef.current = meter;
    if (meter) void meter.start();

    return () => {
      openRef.current = false;
      recognizer.stop();
      recognizerRef.current = null;
      meterRef.current?.stop();
      meterRef.current = null;
      if (silenceTimerRef.current !== null) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, applyPhase]);

  useEffect(() => {
    const bargeIn = () => {
      if (Date.now() - speakStartRef.current < 800) return false;
      stopSpeaking();
      applyPhase("listening");
      return true;
    };
    handleInterimRef.current = (text: string) => {
      if (!openRef.current) return;
      if (phaseRef.current === "speaking") {
        if (text.trim().length < 3 || !bargeIn()) return;
      }
      setInterim(text);
    };
    handleFinalRef.current = (text: string) => {
      if (!openRef.current) return;
      if (phaseRef.current === "speaking" && !bargeIn()) return;
      if (statusRef.current !== "idle") {
        onStopRef.current();
        applyPhase("listening");
      }
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
  }, [onSend, applyPhase]);

  useEffect(() => {
    if (!open || status === "idle") return;
    applyPhase("thinking");
  }, [open, status, applyPhase]);

  useEffect(() => {
    if (!open || status !== "idle") return;
    const last = lastAssistant;
    if (
      last &&
      !last.error &&
      last.content &&
      spokenIdRef.current !== last.id &&
      !pendingRef.current
    ) {
      spokenIdRef.current = last.id;
      applyPhase("speaking");
      speakStartRef.current = Date.now();
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
  }, [open, status, lastAssistant, applyPhase, resumeListening, startMic]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    closeRef.current = handleClose;
  }, [handleClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      trapTabKey(dialogRef.current, event);
      if (event.key !== "Escape") return;
      if (phaseRef.current === "speaking") {
        stopSpeaking();
        applyPhase("listening");
        return;
      }
      event.preventDefault();
      closeRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, applyPhase]);

  if (!open) return null;

  const ui = PHASE_UI[phase];
  const OrbIcon =
    phase === "listening" ? MicIcon : phase === "thinking" ? SparklesIcon : SpeakerIcon;

  const handleOrbClick = () => {
    if (phase === "speaking") {
      stopSpeaking();
      applyPhase("listening");
    } else if (phase === "listening" && error) {
      setError(null);
      startMic();
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Live voice conversation"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      <div className="animate-fade-in absolute inset-0 bg-slate-950/95 backdrop-blur-2xl" />

      <div
        aria-hidden
        className="live-blob absolute -top-44 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{
          background: "radial-gradient(circle, var(--accent) 0%, transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="live-blob absolute -bottom-52 -left-36 h-[30rem] w-[30rem] rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(circle, #22d3ee 0%, transparent 65%)",
          animationDelay: "-6s",
        }}
      />
      <div
        aria-hidden
        className="live-blob absolute -right-36 top-1/4 h-[26rem] w-[26rem] rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(circle, #c084fc 0%, transparent 65%)",
          animationDelay: "-11s",
        }}
      />

      <div className="relative z-10 flex h-full flex-col items-center px-6 py-5">
        <div className="flex w-full max-w-3xl items-center justify-between">
          <div className="flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur"
            style={{
              borderColor: "var(--accent-border)",
              backgroundColor: "var(--accent-badge-bg)",
            }}
          >
            <span
              className={`h-2 w-2 rounded-full ${phase === "thinking" ? "animate-pulse" : "animate-ping"}`}
              style={{ backgroundColor: "var(--accent)" }}
            />
            <span
              className="text-xs font-semibold"
              style={{ color: "var(--accent-text)" }}
            >
              {ui.label}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close live voice mode"
            className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 backdrop-blur transition-all hover:scale-105 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400 active:scale-95"
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 py-4">
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
            className="group relative flex h-60 w-60 items-center justify-center rounded-full transition-transform duration-300 hover:scale-105 focus-visible:outline-2 focus-visible:outline-indigo-400 active:scale-95"
          >
            {phase === "listening" && !error && (
              <>
                <span
                  className="live-ring absolute inset-4 rounded-full border-2"
                  style={{ borderColor: "var(--accent-border)" }}
                />
                <span
                  className="live-ring absolute inset-4 rounded-full border-2"
                  style={{
                    borderColor: "var(--accent-border)",
                    animationDelay: "0.6s",
                  }}
                />
                <span
                  className="live-ring absolute inset-4 rounded-full border-2"
                  style={{
                    borderColor: "var(--accent-border)",
                    animationDelay: "1.2s",
                  }}
                />
              </>
            )}
            {phase === "thinking" && (
              <>
                <span
                  className="live-spin absolute inset-3 rounded-full"
                  style={{
                    background:
                      "conic-gradient(from 0deg, transparent 5%, var(--accent) 28%, transparent 55%)",
                  }}
                />
                <span className="absolute inset-6 rounded-full bg-slate-950" />
              </>
            )}
            <span
              ref={orbRef}
              className={`absolute inset-8 rounded-full ${
                phase === "listening" ? "" : "live-orb"
              }`}
              style={{
                background: "linear-gradient(140deg, var(--accent-soft), var(--accent))",
                boxShadow:
                  "0 0 90px -10px var(--accent), inset 0 2px 20px rgba(255, 255, 255, 0.35)",
                willChange: "transform",
                transition: "transform 90ms ease-out, box-shadow 120ms ease-out",
              }}
            />
            <OrbIcon
              width={44}
              height={44}
              className="relative text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
            />
          </button>

          <div className="flex h-10 items-center gap-1.5" aria-hidden>
            {[0, 1, 2, 3, 4, 5, 6].map((bar, index) => (
              <span
                key={bar}
                ref={(el) => {
                  barsRef.current[index] = el;
                }}
                className={`w-1.5 rounded-full ${
                  phase === "listening" ? "" : "live-bar"
                } ${phase === "thinking" ? "opacity-25" : "opacity-90"}`}
                style={{
                  height: "2.5rem",
                  transformOrigin: "center",
                  transform: phase === "listening" ? "scaleY(0.3)" : undefined,
                  background:
                    "linear-gradient(180deg, var(--accent-soft), var(--accent))",
                  animationDelay: `${bar * 0.13}s`,
                  animationDuration: phase === "speaking" ? "0.7s" : "1.1s",
                  willChange: "transform",
                  transition: "transform 90ms ease-out",
                }}
              />
            ))}
          </div>

          <div className="text-center">
            <p
              aria-live="polite"
              className={`text-2xl font-bold ${
                phase === "thinking" ? "shimmer-text" : "gradient-text"
              }`}
            >
              {ui.label}
              {phase === "listening" ? "…" : ""}
            </p>
            <p className="mt-1 text-xs text-slate-400">{ui.hint}</p>
          </div>

          {error && (
            <div className="flex flex-col items-center gap-2">
              <p
                role="alert"
                className="max-w-md rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-center text-xs text-red-300 backdrop-blur"
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
                  className="text-xs font-medium text-slate-300 underline decoration-slate-600 underline-offset-4 hover:text-white"
                >
                  Try the microphone again
                </button>
              )}
            </div>
          )}

          <p
            aria-live="polite"
            className="min-h-[3.5rem] max-w-xl text-center text-xl font-medium leading-relaxed text-white"
          >
            {interim ? (
              <span className="text-slate-400">{interim}</span>
            ) : (
              heard ||
              (phase === "listening" && !error ? (
                <span className="text-slate-500">Say anything…</span>
              ) : (
                ""
              ))
            )}
          </p>

          {lastAssistant && lastAssistant.content && (
            <div className="max-h-36 w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-200 backdrop-blur">
              <p
                className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--accent-text)" }}
              >
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
              className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs font-medium text-slate-200 backdrop-blur transition-all hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-indigo-400"
            >
              Stop generating
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border px-7 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur transition-all hover:scale-105 focus-visible:outline-2 focus-visible:outline-indigo-400 active:scale-95"
            style={{
              borderColor: "var(--accent-border)",
              background: "linear-gradient(120deg, var(--accent-soft), var(--accent))",
              boxShadow: "0 8px 30px -8px var(--accent)",
            }}
          >
            End voice mode
          </button>
          <p className="text-[11px] text-slate-500">
            Voice recognition works best in Chrome or Edge.
          </p>
        </div>
      </div>
    </div>
  );
}
