"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SendIcon, StopIcon } from "./icons";

interface ComposerProps {
  busy: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
}

export function Composer({ busy, onSend, onStop }: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setValue("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [value, busy, onSend]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    },
    [submit]
  );

  return (
    <form
      className="border-t border-white/10 bg-slate-900/80 px-4 py-4 backdrop-blur sm:px-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <div className="flex min-w-0 flex-1 items-end rounded-2xl border border-white/10 bg-slate-800/80 transition-colors focus-within:border-indigo-400/60">
          <label htmlFor="chat-input" className="sr-only">
            Message the AI assistant
          </label>
          <textarea
            id="chat-input"
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={busy ? "AI is responding…" : "Send a message…"}
            rows={1}
            disabled={busy}
            aria-describedby="chat-input-hint"
            className="max-h-[200px] min-h-[44px] w-full resize-none bg-transparent px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none disabled:opacity-60"
          />
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
            disabled={!value.trim()}
            aria-label="Send message"
            title="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-950/50 transition-all hover:from-indigo-400 hover:to-violet-500 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SendIcon width={16} height={16} />
          </button>
        )}
      </div>
      <p
        id="chat-input-hint"
        className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-slate-500"
      >
        Enter to send · Shift + Enter for a new line
      </p>
    </form>
  );
}
