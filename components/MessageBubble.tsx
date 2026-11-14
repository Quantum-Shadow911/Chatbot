"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Attachment, Message } from "@/lib/types";
import {
  friendlyCanvasPhrasing,
  splitCanvasSegments,
  stripCanvasBlocks,
  withStableId,
  type CanvasArtifact,
} from "@/lib/canvas";
import { formatBytes } from "@/lib/attachments";
import { formatDate, formatTime } from "@/lib/utils";
import { CanvasCard, CanvasPendingCard } from "./CanvasCard";
import { CopyButton } from "./CopyButton";
import { Markdown } from "./Markdown";
import { TypingIndicator } from "./TypingIndicator";
import {
  AlertIcon,
  BotIcon,
  ChevronDownIcon,
  DownloadIcon,
  EditIcon,
  FileIcon,
  ImageIcon,
  RefreshIcon,
  SpeakerIcon,
  StopIcon,
} from "./icons";
import { printPdf } from "@/lib/pdf";

interface MessageBubbleProps {
  message: Message;
  isStreaming: boolean;
  isLastAssistant: boolean;
  isEditing: boolean;
  canRegenerate: boolean;
  isSpeaking: boolean;
  onSpeakToggle: (message: Message) => void;
  onOpenCanvas: (artifact: CanvasArtifact, streaming?: boolean) => void;
  conversationTitle: string;
  onRegenerate: () => void;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
  onEditResend: (id: string, content: string) => boolean;
}

function AttachmentList({ attachments, isUser }: { attachments: Attachment[]; isUser: boolean }) {
  if (attachments.length === 0) return null;
  const images = attachments.filter((a) => a.kind === "image" && a.dataUrl);
  const others = attachments.filter((a) => !(a.kind === "image" && a.dataUrl));
  return (
    <div className="mb-2 flex flex-col gap-2">
      {images.length > 0 && (
        <div className={`flex flex-wrap gap-2 ${isUser ? "justify-end" : ""}`}>
          {images.map((attachment) => (
            <a
              key={attachment.id}
              href={attachment.dataUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-xl border border-white/20"
            >
              <img
                src={attachment.dataUrl}
                alt={attachment.name}
                className="max-h-56 max-w-[220px] object-cover"
              />
            </a>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <ul className={`flex flex-wrap gap-2 ${isUser ? "justify-end" : ""}`}>
          {others.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/20 px-2 py-1 text-xs text-slate-200"
            >
              {attachment.kind === "text" ? (
                <FileIcon width={13} height={13} className="shrink-0" />
              ) : (
                <ImageIcon width={13} height={13} className="shrink-0" />
              )}
              <span className="max-w-[180px] truncate">{attachment.name}</span>
              <span className="text-slate-400">{formatBytes(attachment.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ThinkingPanel({
  reasoning,
  active,
}: {
  reasoning: string;
  active: boolean;
}) {
  const [expanded, setExpanded] = useState(active);
  const wasActive = useRef(active);

  useEffect(() => {
    if (wasActive.current && !active) setExpanded(false);
    if (!wasActive.current && active) setExpanded(true);
    wasActive.current = active;
  }, [active]);

  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-white/10 bg-slate-900/70">
      <button
        type="button"
        onClick={() => setExpanded((state) => !state)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-200"
      >
        {active ? (
          <span className="shimmer-text">Thinking…</span>
        ) : (
          <span>Thought process</span>
        )}
        <ChevronDownIcon
          width={12}
          height={12}
          className={`ml-auto shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <p className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words border-t border-white/5 px-2.5 py-2 text-[11px] leading-relaxed text-slate-400">
          {reasoning}
        </p>
      )}
    </div>
  );
}

function MessageBubbleImpl({
  message,
  isStreaming,
  isLastAssistant,
  isEditing,
  canRegenerate,
  isSpeaking,
  onSpeakToggle,
  onOpenCanvas,
  conversationTitle,
  onRegenerate,
  onEdit,
  onCancelEdit,
  onEditResend,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const editing = isUser && isEditing;
  const [draft, setDraft] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const segments = useMemo(
    () => (isUser ? null : splitCanvasSegments(message.content)),
    [isUser, message.content]
  );
  const hasCanvas = useMemo(
    () => segments?.some((s) => s.kind !== "text") ?? false,
    [segments]
  );

  useEffect(() => {
    if (editing) {
      setDraft(message.content);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [isEditing, message.content]);

  if (editing) {
    return (
      <div className="message-row message-row-user">
        <div className="flex w-full max-w-[85%] flex-col items-end sm:max-w-[75%]">
          <div className="w-full rounded-2xl border border-indigo-400/40 bg-slate-900 p-3">
            <label htmlFor="edit-message" className="sr-only">
              Edit your message
            </label>
            <textarea
              id="edit-message"
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (draft.trim()) onEditResend(message.id, draft);
                }
                if (e.key === "Escape") onCancelEdit();
              }}
              rows={Math.min(8, draft.split("\n").length + 1)}
              className="w-full resize-none bg-transparent text-sm text-slate-100 outline-none"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => draft.trim() && onEditResend(message.id, draft)}
                disabled={!draft.trim()}
                className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save &amp; resend
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`message-row ${isUser ? "message-row-user" : "message-row-assistant"}`}>
      {!isUser && (
        <div
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm"
          aria-hidden
        >
          <BotIcon width={15} height={15} />
        </div>
      )}
      <div
        className={`flex min-w-0 max-w-[85%] flex-col sm:max-w-[75%] ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div
          data-pdf-block={message.error ? undefined : true}
          data-message-role={isUser ? "user" : "assistant"}
          className={
            isUser
              ? "rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-500 to-indigo-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-md shadow-indigo-950/40"
              : message.error
                ? "flex items-start gap-2 rounded-2xl rounded-tl-md border border-red-500/30 bg-red-950/40 px-4 py-2.5 text-sm leading-relaxed text-red-200"
                : `rounded-2xl rounded-tl-md border border-white/10 bg-slate-800/80 px-4 py-2.5 text-sm leading-relaxed text-slate-100 shadow-md shadow-slate-950/30 ${
                    isStreaming && message.content !== "" ? "bubble-streaming" : ""
                  }`
          }
        >
          {!message.error && (message.attachments?.length ?? 0) > 0 && (
            <AttachmentList attachments={message.attachments ?? []} isUser={isUser} />
          )}
          {!message.error && !isUser && (message.reasoning ?? "").length > 0 && (
            <ThinkingPanel
              reasoning={message.reasoning ?? ""}
              active={isStreaming && message.content === ""}
            />
          )}
          {message.error ? (
            <>
              <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">Could not generate a response</p>
                <p className="mt-0.5 text-red-300/90">{message.content}</p>
                {canRegenerate && (
                  <button
                    type="button"
                    onClick={onRegenerate}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 px-2.5 py-1 text-xs font-medium text-red-200 hover:bg-red-500/10"
                  >
                    <RefreshIcon width={13} height={13} /> Try again
                  </button>
                )}
              </div>
            </>
          ) : isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : message.content === "" && isStreaming && !message.reasoning ? (
            <TypingIndicator />
          ) : message.content === "" && isStreaming && message.reasoning ? (
            <p className="shimmer-text text-xs text-slate-400">Working on it…</p>
          ) : (
            <div data-message-body={message.id} className="flex min-w-0 flex-col gap-2">
              {(hasCanvas ? segments! : [{ kind: "text" as const, text: message.content }]).map(
                (segment, segmentIndex) =>
                segment.kind === "text" ? (
                  segment.text.trim().length > 0 ? (
                    <Markdown
                      key={segmentIndex}
                      content={friendlyCanvasPhrasing(segment.text.trim())}
                    />
                  ) : null
                ) : segment.kind === "canvas" ? (
                  <CanvasCard key={segmentIndex} artifact={segment.artifact} onOpen={onOpenCanvas} />
                ) : isStreaming ? (
                  <CanvasPendingCard
                    key={segmentIndex}
                    artifact={segment.artifact}
                    onOpen={(artifact) => onOpenCanvas(artifact, true)}
                  />
                ) : segment.artifact.content.trim() ? (
                  // Generation finished without a close marker — recover the
                  // partial canvas instead of showing "Creating…" forever.
                  <CanvasCard
                    key={segmentIndex}
                    artifact={withStableId(segment.artifact)}
                    onOpen={onOpenCanvas}
                  />
                ) : (
                  <p
                    key={segmentIndex}
                    className="text-xs text-slate-500"
                  >
                    Canvas wasn’t finished.
                  </p>
                )
              )}
            </div>
          )}
        </div>
        <div className={`mt-1 flex items-center gap-1 px-1 ${isUser ? "flex-row-reverse" : ""}`}>
          <time
            dateTime={new Date(message.createdAt).toISOString()}
            className="text-[11px] text-slate-500"
          >
            {formatTime(message.createdAt)}
          </time>
          {!isUser && !message.error && message.content !== "" && (
            <CopyButton text={stripCanvasBlocks(message.content) || message.content} label="" className="!px-1.5" />
          )}
          {!isUser && !message.error && message.content !== "" && !isStreaming && (
            <button
              type="button"
              onClick={() => onSpeakToggle(message)}
              aria-label={isSpeaking ? "Stop reading aloud" : "Read aloud"}
              title={isSpeaking ? "Stop reading" : "Read aloud"}
              className="rounded-md p-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-400"
            >
              {isSpeaking ? (
                <StopIcon width={13} height={13} />
              ) : (
                <SpeakerIcon width={13} height={13} />
              )}
            </button>
          )}
          {!isUser && !message.error && message.content !== "" && !isStreaming && (
            <button
              type="button"
              onClick={() => {
                const body = document.querySelector(
                  `[data-message-body="${message.id}"]`
                );
                if (body) {
                  printPdf(
                    conversationTitle || "AI response",
                    body.innerHTML,
                    `Generated by AI Chatbot · ${formatDate(message.createdAt)}`
                  );
                }
              }}
              aria-label="Download as PDF"
              title="Download as PDF"
              className="rounded-md p-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-400"
            >
              <DownloadIcon width={13} height={13} />
            </button>
          )}
          {isUser && !isStreaming && (
            <button
              type="button"
              onClick={() => onEdit(message.id)}
              aria-label="Edit and resend message"
              title="Edit and resend"
              className="rounded-md p-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-400"
            >
              <EditIcon width={13} height={13} />
            </button>
          )}
          {isLastAssistant && !isStreaming && !message.error && canRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              aria-label="Regenerate response"
              title="Regenerate response"
              className="rounded-md p-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-400"
            >
              <RefreshIcon width={13} height={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);
