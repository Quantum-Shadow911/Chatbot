"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type {
  ChatRequestMessage,
  Conversation,
  Message,
  Role,
} from "@/lib/types";
import { formatBytes } from "@/lib/attachments";
import {
  loadActiveConversationId,
  loadConversations,
  saveActiveConversationId,
  saveConversations,
} from "@/lib/storage";
import { generateId, titleFromContent } from "@/lib/utils";

type Status = "idle" | "loading" | "streaming";

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  status: Status;
  streamingMessageId: string | null;
  hydrated: boolean;
}

type Action =
  | { type: "HYDRATE"; conversations: Conversation[]; activeId: string | null }
  | { type: "NEW_CHAT"; conversation: Conversation }
  | { type: "SELECT"; id: string }
  | { type: "RENAME"; id: string; title: string }
  | { type: "DELETE"; id: string }
  | { type: "ADD_MESSAGE"; conversationId: string; message: Message }
  | { type: "APPEND_DELTA"; conversationId: string; messageId: string; delta: string }
  | { type: "SET_MESSAGE_ERROR"; conversationId: string; messageId: string; error: string }
  | { type: "SET_STATUS"; status: Status }
  | { type: "END_STREAM" }
  | { type: "TRUNCATE_AFTER"; conversationId: string; messageId: string }
  | { type: "UPDATE_MESSAGE"; conversationId: string; messageId: string; content: string }
  | { type: "DELETE_MESSAGE"; conversationId: string; messageId: string };

function buildTextWithAttachments(message: Message): string {
  const parts: string[] = [];
  if (message.content.trim().length > 0) parts.push(message.content);
  for (const attachment of message.attachments ?? []) {
    if (attachment.kind === "text" && attachment.text) {
      parts.push(`[Attached file: ${attachment.name}]\n${attachment.text}`);
    } else if (attachment.kind !== "image") {
      parts.push(
        `[Attached file: ${attachment.name} (${attachment.mime || "unknown type"}, ${formatBytes(attachment.size)}) — binary content not included]`
      );
    }
  }
  return parts.join("\n\n") || "(The user attached files.)";
}

function buildApiMessages(history: Message[]): ChatRequestMessage[] {
  return history
    .filter(
      (m) =>
        !m.error &&
        (m.role === "user" ||
          m.content.trim().length > 0 ||
          (m.attachments ?? []).length > 0)
    )
    .map((message) => {
      const images = (message.attachments ?? []).filter(
        (a) => a.kind === "image" && a.dataUrl
      );
      const text = buildTextWithAttachments(message);
      if (images.length === 0) return { role: message.role, content: text };
      return {
        role: message.role,
        content: [
          { type: "text" as const, text },
          ...images.map((attachment) => ({
            type: "image_url" as const,
            image_url: { url: attachment.dataUrl as string },
          })),
        ],
      };
    });
}

function touch(conversation: Conversation): Conversation {
  return { ...conversation, updatedAt: Date.now() };
}

function mapConversation(
  state: ChatState,
  id: string,
  fn: (c: Conversation) => Conversation
): ChatState {
  let changed = false;
  const conversations = state.conversations.map((c) => {
    if (c.id !== id) return c;
    changed = true;
    return fn(c);
  });
  return changed ? { ...state, conversations } : state;
}

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case "HYDRATE":
      return {
        ...state,
        conversations: action.conversations,
        activeId: action.activeId,
        hydrated: true,
      };
    case "NEW_CHAT":
      return {
        ...state,
        conversations: [action.conversation, ...state.conversations],
        activeId: action.conversation.id,
      };
    case "SELECT":
      return { ...state, activeId: action.id };
    case "RENAME":
      return mapConversation(state, action.id, (c) => ({
        ...c,
        title: action.title.trim() || c.title,
      }));
    case "DELETE": {
      const conversations = state.conversations.filter((c) => c.id !== action.id);
      const activeId =
        state.activeId === action.id ? conversations[0]?.id ?? null : state.activeId;
      return { ...state, conversations, activeId };
    }
    case "ADD_MESSAGE":
      return mapConversation(state, action.conversationId, (c) =>
        touch({
          ...c,
          title:
            c.messages.length === 0 && action.message.role === "user"
              ? titleFromContent(action.message.content)
              : c.title,
          messages: [...c.messages, action.message],
        })
      );
    case "APPEND_DELTA":
      return mapConversation(state, action.conversationId, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === action.messageId ? { ...m, content: m.content + action.delta } : m
        ),
      }));
    case "SET_MESSAGE_ERROR":
      return mapConversation(state, action.conversationId, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === action.messageId ? { ...m, content: action.error, error: true } : m
        ),
      }));
    case "SET_STATUS":
      return { ...state, status: action.status };
    case "END_STREAM":
      return { ...state, status: "idle", streamingMessageId: null };
    case "TRUNCATE_AFTER":
      return mapConversation(state, action.conversationId, (c) => {
        const index = c.messages.findIndex((m) => m.id === action.messageId);
        if (index === -1) return c;
        return touch({ ...c, messages: c.messages.slice(0, index + 1) });
      });
    case "UPDATE_MESSAGE":
      return mapConversation(state, action.conversationId, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === action.messageId ? { ...m, content: action.content } : m
        ),
      }));
    case "DELETE_MESSAGE":
      return mapConversation(state, action.conversationId, (c) =>
        touch({ ...c, messages: c.messages.filter((m) => m.id !== action.messageId) })
      );
    default:
      return state;
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (
      typeof data === "object" &&
      data !== null &&
      typeof (data as Record<string, unknown>).error === "string"
    ) {
      return (data as { error: string }).error;
    }
  } catch {
    // Fall through to generic message.
  }
  return "Something went wrong while generating a response. Please try again.";
}

export function useChat() {
  const [state, dispatch] = useReducer(reducer, {
    conversations: [],
    activeId: null,
    status: "idle",
    streamingMessageId: null,
    hydrated: false,
  });

  const abortRef = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const conversations = loadConversations();
    const storedActive = loadActiveConversationId();
    const activeId =
      storedActive && conversations.some((c) => c.id === storedActive)
        ? storedActive
        : conversations[0]?.id ?? null;
    dispatch({ type: "HYDRATE", conversations, activeId });
  }, []);

  useEffect(() => {
    if (state.hydrated) saveConversations(state.conversations);
  }, [state.conversations, state.hydrated]);

  useEffect(() => {
    if (state.hydrated) saveActiveConversationId(state.activeId);
  }, [state.activeId, state.hydrated]);

  const activeConversation = useMemo(
    () => state.conversations.find((c) => c.id === state.activeId) ?? null,
    [state.conversations, state.activeId]
  );

  const runCompletion = useCallback(
    async (conversationId: string, history: Message[]) => {
      const assistantId = generateId();
      dispatch({
        type: "ADD_MESSAGE",
        conversationId,
        message: {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: Date.now(),
        },
      });
      dispatch({ type: "SET_STATUS", status: "loading" });

      const controller = new AbortController();
      abortRef.current = controller;

      const payload = buildApiMessages(history);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: payload }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const message = await parseErrorMessage(response);
          dispatch({ type: "END_STREAM" });
          dispatch({
            type: "SET_MESSAGE_ERROR",
            conversationId,
            messageId: assistantId,
            error: message,
          });
          return;
        }

        const body = response.body;
        if (!body) {
          dispatch({ type: "END_STREAM" });
          dispatch({
            type: "SET_MESSAGE_ERROR",
            conversationId,
            messageId: assistantId,
            error: "The AI service returned an empty response. Please try again.",
          });
          return;
        }

        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handleEvent = (data: string) => {
          if (data === "[DONE]") return;
          try {
            const parsed: unknown = JSON.parse(data);
            if (
              typeof parsed === "object" &&
              parsed !== null &&
              Array.isArray((parsed as Record<string, unknown>).choices)
            ) {
              const choice = (parsed as { choices: unknown[] }).choices[0];
              if (
                typeof choice === "object" &&
                choice !== null &&
                typeof (choice as Record<string, unknown>).delta === "object" &&
                (choice as Record<string, unknown>).delta !== null
              ) {
                const delta = (choice as { delta: Record<string, unknown> }).delta;
                if (typeof delta.content === "string" && delta.content.length > 0) {
                  dispatch({
                    type: "APPEND_DELTA",
                    conversationId,
                    messageId: assistantId,
                    delta: delta.content,
                  });
                }
              }
            }
          } catch {
            // Ignore malformed SSE chunks.
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data:")) {
              handleEvent(trimmed.slice(5).trim());
            }
          }
        }
        const rest = buffer.trim();
        if (rest.startsWith("data:")) handleEvent(rest.slice(5).trim());

        dispatch({ type: "END_STREAM" });
      } catch (error) {
        dispatch({ type: "END_STREAM" });
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        dispatch({
          type: "SET_MESSAGE_ERROR",
          conversationId,
          messageId: assistantId,
          error:
            "The connection to the AI service was interrupted. Please check your network and try again.",
        });
      } finally {
        abortRef.current = null;
      }
    },
    []
  );

  const sendMessage = useCallback(
    (content: string, attachments?: Message["attachments"]) => {
      const trimmed = content.trim();
      const current = stateRef.current;
      const conversationId = current.activeId;
      const hasAttachments = Boolean(attachments && attachments.length > 0);
      if ((!trimmed && !hasAttachments) || !conversationId || current.status !== "idle") return;
      const message: Message = {
        id: generateId(),
        role: "user" as Role,
        content: trimmed,
        createdAt: Date.now(),
        ...(hasAttachments ? { attachments } : {}),
      };
      const conversation = stateRef.current.conversations.find(
        (c) => c.id === conversationId
      );
      if (!conversation) return;
      dispatch({ type: "ADD_MESSAGE", conversationId, message });
      void runCompletion(conversationId, [...conversation.messages, message]);
    },
    [runCompletion]
  );

  const regenerate = useCallback(() => {
    const current = stateRef.current;
    const conversationId = current.activeId;
    if (!conversationId || current.status !== "idle") return;
    const conversation = current.conversations.find((c) => c.id === conversationId);
    if (!conversation) return;
    const last = conversation.messages[conversation.messages.length - 1];
    if (!last || last.role !== "assistant") return;
    dispatch({ type: "DELETE_MESSAGE", conversationId, messageId: last.id });
    void runCompletion(conversationId, conversation.messages.slice(0, -1));
  }, [runCompletion]);

  const editAndResend = useCallback(
    (messageId: string, content: string) => {
      const trimmed = content.trim();
      const current = stateRef.current;
      const conversationId = current.activeId;
      if (!trimmed || !conversationId || current.status !== "idle") return false;
      const conversation = current.conversations.find((c) => c.id === conversationId);
      if (!conversation) return false;
      const index = conversation.messages.findIndex((m) => m.id === messageId);
      if (index === -1 || conversation.messages[index].role !== "user") return false;
      dispatch({ type: "UPDATE_MESSAGE", conversationId, messageId, content: trimmed });
      dispatch({ type: "TRUNCATE_AFTER", conversationId, messageId });
      const history = [
        ...conversation.messages.slice(0, index),
        { ...conversation.messages[index], content: trimmed },
      ];
      void runCompletion(conversationId, history);
      return true;
    },
    [runCompletion]
  );

  const startNewChat = useCallback(() => {
    const now = Date.now();
    const conversation: Conversation = {
      id: generateId(),
      title: "New chat",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    dispatch({ type: "NEW_CHAT", conversation });
  }, []);

  const selectConversation = useCallback((id: string) => {
    dispatch({ type: "SELECT", id });
  }, []);

  const renameConversation = useCallback((id: string, title: string) => {
    dispatch({ type: "RENAME", id, title });
  }, []);

  const deleteConversation = useCallback((id: string) => {
    dispatch({ type: "DELETE", id });
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    ...state,
    activeConversation,
    sendMessage,
    regenerate,
    editAndResend,
    startNewChat,
    selectConversation,
    renameConversation,
    deleteConversation,
    stopGeneration,
  };
}
