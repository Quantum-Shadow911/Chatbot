"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatBytes, processFiles } from "@/lib/attachments";
import { unlockAudioPlayback } from "@/lib/speech";
import type { Attachment } from "@/lib/types";
import {
  createRecognizer,
  speechRecognitionSupported,
  type Recognizer,
} from "@/lib/voice";
import {
  CloseIcon,
  FileIcon,
  MicIcon,
  PaperclipIcon,
  SendIcon,
  StopIcon,
  WaveformIcon,
} from "./icons";

interface ComposerProps {
  busy: boolean;
  onSend: (content: string, attachments?: Attachment[]) => void;
  onStop: () => void;
  modelSupportsImages: boolean;
  onOpenLive: () => void;
}

export function Composer({
  busy,
  onSend,
  onStop,
  modelSupportsImages,
  onOpenLive,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const [micAvailable, setMicAvailable] = useState(false);
  const [dictating, setDictating] = useState(false);
  const dictationRef = useRef<Recognizer | null>(null);
  const dictBaseRef = useRef("");

  useEffect(() => {
    setMicAvailable(speechRecognitionSupported());
  }, []);

  useEffect(() => () => dictationRef.current?.stop(), []);

  const stopDictation = useCallback(() => {
    dictationRef.current?.stop();
    dictationRef.current = null;
    setDictating(false);
  }, []);

  const toggleDictation = useCallback(() => {
    unlockAudioPlayback();
    if (dictating) {
      stopDictation();
      return;
    }
    if (!speechRecognitionSupported()) {
      setFileError("Voice typing needs Chrome, Edge, or Safari.");
      return;
    }
    dictBaseRef.current = value;
    setDictating(true);
    const recognizer = createRecognizer({
      onFinal: (text) => {
        dictBaseRef.current = `${dictBaseRef.current} ${text}`.trim();
        setValue(dictBaseRef.current);
      },
      onInterim: (text) => {
        setValue(
          text ? `${dictBaseRef.current} ${text}`.trim() : dictBaseRef.current
        );
      },
      onError: (message) => {
        setFileError(message);
        stopDictation();
      },
    });
    dictationRef.current = recognizer;
    recognizer.start();
  }, [dictating, stopDictation, value]);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    if (files.length === 0) return;
    const { attachments: processed, errors } = await processFiles(files);
    if (processed.length > 0) {
      setAttachments((current) => [...current, ...processed]);
    }
    setFileError(errors.length > 0 ? errors.join(" ") : null);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => current.filter((a) => a.id !== id));
  }, []);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || busy) return;
    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    stopDictation();
    setValue("");
    setAttachments([]);
    setFileError(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [value, attachments, busy, onSend, stopDictation]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    },
    [submit]
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(event.clipboardData.files);
      if (files.length > 0) {
        event.preventDefault();
        void addFiles(files);
      }
    },
    [addFiles]
  );

  const hasContent = value.trim().length > 0 || attachments.length > 0;

  return (
    <form
      className="border-t border-white/10 bg-slate-900/80 px-4 py-4 backdrop-blur sm:px-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepthRef.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepthRef.current = 0;
        setDragging(false);
        void addFiles(event.dataTransfer.files);
      }}
    >
      <div className="mx-auto max-w-3xl">
        {attachments.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2" aria-label="Attached files">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="chip-in relative flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800/80 py-1.5 pl-1.5 pr-7"
              >
                {attachment.kind === "image" && attachment.dataUrl ? (
                  <img
                    src={attachment.dataUrl}
                    alt=""
                    className="h-9 w-9 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-700/60 text-slate-300">
                    <FileIcon width={15} height={15} />
                  </span>
                )}
                <span className="flex max-w-[160px] flex-col">
                  <span className="truncate text-xs font-medium text-slate-200">
                    {attachment.name}
                  </span>
                  <span className="text-[10px] text-slate-500">{formatBytes(attachment.size)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(attachment.id)}
                  aria-label={`Remove ${attachment.name}`}
                  className="absolute right-1 top-1 rounded-full p-0.5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                >
                  <CloseIcon width={11} height={11} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div
          className={`flex items-end gap-2 rounded-2xl border bg-slate-800/80 transition-all focus-within:border-indigo-400/60 focus-within:shadow-[0_0_0_3px_var(--accent-badge-bg)] ${
            dragging
              ? "border-indigo-400/80 bg-indigo-500/10 shadow-[0_0_0_3px_var(--accent-badge-bg)]"
              : "border-white/10"
          }`}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach files"
            title="Attach images or files"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-l-2xl text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-400"
          >
            <PaperclipIcon width={17} height={17} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={(event) => {
              if (event.target.files) void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <label htmlFor="chat-input" className="sr-only">
            Message the AI assistant
          </label>
          <textarea
            id="chat-input"
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={busy ? "AI is responding…" : "Send a message…"}
            rows={1}
            aria-describedby="chat-input-hint"
            className="max-h-[200px] min-h-[44px] w-full resize-none bg-transparent py-3 pr-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none disabled:opacity-60"
          />
        </div>

        {fileError && (
          <p role="alert" className="mt-2 text-xs text-red-300">
            {fileError}
          </p>
        )}

        {!modelSupportsImages &&
          attachments.some((a) => a.kind === "image") && (
            <p
              role="status"
              className="mt-2 rounded-lg border px-2.5 py-1.5 text-xs"
              style={{
                borderColor: "var(--accent-border)",
                backgroundColor: "var(--accent-badge-bg)",
                color: "var(--accent-text)",
              }}
            >
              The selected model can’t see images. Pick a vision-capable model
              from the header dropdown, or remove the image — the rest of your
              message will still work.
            </p>
          )}
      </div>

      <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {micAvailable && (
            <>
              <button
                type="button"
                onClick={toggleDictation}
                aria-label={dictating ? "Stop voice typing" : "Type with your voice"}
                aria-pressed={dictating}
                title={dictating ? "Stop voice typing" : "Voice typing — paste what you say into the box"}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-indigo-400 ${
                  dictating
                    ? "animate-pulse text-[var(--accent-text)]"
                    : "text-slate-400 hover:bg-white/10 hover:text-slate-200"
                }`}
                style={
                  dictating
                    ? { backgroundColor: "var(--accent-badge-bg)" }
                    : undefined
                }
              >
                <MicIcon width={15} height={15} />
              </button>
              <button
                type="button"
                onClick={onOpenLive}
                aria-label="Start live voice conversation"
                title="Live voice mode"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-400"
              >
                <WaveformIcon width={15} height={15} />
              </button>
            </>
          )}
          <p id="chat-input-hint" className="truncate text-[11px] text-slate-500">
            Enter to send · Shift + Enter for a new line
          </p>
        </div>
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating response"
            title="Stop generating"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-200 transition-colors hover:bg-slate-600 focus-visible:outline-2 focus-visible:outline-indigo-400"
          >
            <StopIcon width={16} height={16} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!hasContent}
            aria-label="Send message"
            title="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_6px_26px_-6px_var(--accent)] transition-all hover:scale-105 hover:from-indigo-400 hover:to-violet-500 hover:shadow-[0_8px_34px_-6px_var(--accent)] active:scale-95 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            <SendIcon width={16} height={16} />
          </button>
        )}
      </div>
    </form>
  );
}
