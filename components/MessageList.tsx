"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/types";
import { MessageBubble } from "./MessageBubble";
import { ArrowDownIcon } from "./icons";

interface MessageListProps {
  messages: Message[];
  status: "idle" | "loading" | "streaming";
  canRegenerate: boolean;
  speakingId: string | null;
  onSpeakToggle: (message: Message) => void;
  onRegenerate: () => void;
  onEditResend: (id: string, content: string) => boolean;
}

export function MessageList({
  messages,
  status,
  canRegenerate,
  speakingId,
  onSpeakToggle,
  onRegenerate,
  onEditResend,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const lastMessage = messages[messages.length - 1];
  const lastAssistantId =
    lastMessage && lastMessage.role === "assistant" ? lastMessage.id : null;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
      stickToBottomRef.current = distance < 80;
      setShowJump(distance > 300);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom(status === "idle" ? "smooth" : "auto");
  }, [messages, status, scrollToBottom]);

  const handleEditResend = useCallback(
    (id: string, content: string): boolean => {
      const accepted = onEditResend(id, content);
      if (accepted) setEditingId(null);
      return accepted;
    },
    [onEditResend]
  );

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={containerRef}
        className="h-full overflow-y-auto scroll-smooth px-4 py-6 sm:px-6"
        role="log"
        aria-label="Conversation messages"
        aria-live="polite"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isStreaming={status !== "idle"}
              isLastAssistant={message.id === lastAssistantId}
              isEditing={editingId === message.id}
              canRegenerate={canRegenerate}
              isSpeaking={speakingId === message.id}
              onSpeakToggle={onSpeakToggle}
              onRegenerate={onRegenerate}
              onEdit={setEditingId}
              onCancelEdit={() => setEditingId(null)}
              onEditResend={handleEditResend}
            />
          ))}
        </div>
      </div>
      {showJump && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          aria-label="Scroll to latest message"
          className="animate-pop-in absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-slate-800/90 p-2 text-slate-300 shadow-lg backdrop-blur transition-all hover:scale-110 hover:bg-slate-700 active:scale-95"
        >
          <ArrowDownIcon width={16} height={16} />
        </button>
      )}
    </div>
  );
}
