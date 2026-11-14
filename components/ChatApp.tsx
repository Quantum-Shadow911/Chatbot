"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@/hooks/useChat";
import { useMemory } from "@/hooks/useMemory";
import { useSettings } from "@/hooks/useSettings";
import {
  collectCanvases,
  findCanvasStream,
  findLastCanvas,
  stripCanvasBlocks,
  withStableId,
  type CanvasArtifact,
} from "@/lib/canvas";
import { printPdf } from "@/lib/pdf";
import { speak, stopSpeaking, unlockAudioPlayback } from "@/lib/speech";
import { applyFavicon, DEFAULT_ACCENT, type FaviconVariant } from "@/lib/theme";
import { formatDate } from "@/lib/utils";
import { supportsVision } from "@/lib/vision";
import type { AuthProviderInfo, Message, SessionInfo } from "@/lib/types";
import { Composer } from "./Composer";
import { ErrorBoundary } from "./ErrorBoundary";
import { LiveMode } from "./LiveMode";
import { MessageList } from "./MessageList";
import { ModePicker } from "./ModePicker";
import { ModelPicker } from "./ModelPicker";
import { SettingsModal } from "./SettingsModal";
import { Sidebar } from "./Sidebar";
import { CanvasPanel } from "./CanvasPanel";
import { BotIcon, MenuIcon, SettingsIcon, SparklesIcon } from "./icons";

const SUGGESTIONS: { title: string; prompt: string }[] = [
  {
    title: "Explain something",
    prompt: "Explain how neural networks learn, in simple terms",
  },
  {
    title: "Help me write",
    prompt: "Help me write a friendly email asking my teacher for a deadline extension",
  },
  {
    title: "Make a plan",
    prompt: "Help me plan a productive weekend with time for exercise and rest",
  },
  {
    title: "Quiz me",
    prompt: "Make me a fun quiz about the solar system",
  },
  {
    title: "Debug with me",
    prompt: "I have a bug in my code. Ask me questions to help me figure it out.",
  },
];

interface AvailableModels {
  models: string[];
  default: string;
  visionFallback: boolean;
}

export function ChatApp() {
  const { memories, addMemories, removeMemory, clearMemories } = useMemory();
  const {
    settings,
    setTheme,
    setAccent,
    setMemoryEnabled,
    setModel,
    setReadAloud,
    setNaturalVoice,
    setChatMode,
    setChatMode2,
  } = useSettings();
  const memoryRef = useRef(memories);
  memoryRef.current = memories;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const memoryEnabled = settings.memoryEnabled;
  const [memoryNotice, setMemoryNotice] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<AvailableModels | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [authProviders, setAuthProviders] = useState<AuthProviderInfo[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const speakingIdRef = useRef<string | null>(null);
  const [liveOpen, setLiveOpen] = useState(false);
  const liveOpenRef = useRef(false);
  liveOpenRef.current = liveOpen;
  const [canvas, setCanvas] = useState<CanvasArtifact | null>(null);
  const [canvasLive, setCanvasLive] = useState(false);
  const autoOpenedCanvasRef = useRef<string | null>(null);
  const canvasClosedRef = useRef<string | null>(null);

  const clearSpeech = useCallback(() => {
    stopSpeaking();
    speakingIdRef.current = null;
    setSpeakingId(null);
  }, []);

  const startSpeech = useCallback((message: Message) => {
    const { naturalVoice } = settingsRef.current;
    const started = speak(message.content, {
      naturalVoice,
      onEnd: () => {
        speakingIdRef.current = null;
        setSpeakingId(null);
      },
    });
    speakingIdRef.current = started ? message.id : null;
    setSpeakingId(speakingIdRef.current);
  }, []);

  const handleSpeakToggle = useCallback(
    (message: Message) => {
      if (speakingIdRef.current === message.id) {
        clearSpeech();
        return;
      }
      startSpeech(message);
    },
    [clearSpeech, startSpeech]
  );

  const handleMemoriesExtracted = useCallback(
    (facts: string[]) => {
      if (!memoryEnabled || facts.length === 0) return;
      addMemories(facts);
      setMemoryNotice(
        facts.length === 1
          ? `Remembered: ${facts[0]}`
          : `Remembered ${facts.length} new details`
      );
    },
    [addMemories, memoryEnabled]
  );

  const chat = useChat({
    getMemories: () => (memoryEnabled ? memoryRef.current.map((m) => m.text) : []),
    getModel: () => settings.model,
    getMode: () => settings.mode,
    getMode2: () => settings.mode2,
    getLive: () => liveOpenRef.current,
    onMemoriesExtracted: handleMemoriesExtracted,
  });

  const prevStatusRef = useRef(chat.status);
  useEffect(() => {
    const previous = prevStatusRef.current;
    prevStatusRef.current = chat.status;
    if (chat.status === "loading") clearSpeech();
    if (previous !== "streaming" || chat.status !== "idle") return;
    if (!settingsRef.current.readAloud) return;
    if (liveOpenRef.current) return;
    const last = chat.activeConversation?.messages.at(-1);
    if (!last || last.role !== "assistant" || last.error || !last.content) return;
    startSpeech(last);
  }, [chat.status, chat.activeConversation, clearSpeech, startSpeech]);

  useEffect(() => clearSpeech, [clearSpeech]);

  useEffect(() => {
    if (chat.status === "idle") {
      setCanvasLive(false);
      // Graceful recovery: generation ended but the canvas block was never
      // closed — swap the streaming artifact for its finalized partial.
      const lastMessage = chat.activeConversation?.messages.at(-1);
      if (
        canvas &&
        lastMessage &&
        lastMessage.role === "assistant" &&
        !lastMessage.error &&
        lastMessage.content
      ) {
        const stream = findCanvasStream(lastMessage.content);
        if (stream && !stream.complete && stream.artifact.id === canvas.id) {
          setCanvas(withStableId(stream.artifact));
        }
      }
      return;
    }
    const last = chat.activeConversation?.messages.at(-1);
    if (!last || last.role !== "assistant" || last.error) return;
    const stream = findCanvasStream(last.content);
    if (!stream) return;
    const { artifact, complete } = stream;
    if (canvasClosedRef.current === artifact.id) return;
    if (complete) {
      if (autoOpenedCanvasRef.current === artifact.id) return;
      autoOpenedCanvasRef.current = artifact.id;
      setCanvasLive(false);
      setCanvas(artifact);
      return;
    }
    setCanvasLive(true);
    setCanvas(artifact);
  }, [chat.status, chat.activeConversation?.messages, canvas]);

  useEffect(() => {
    setCanvas(null);
    setCanvasLive(false);
    autoOpenedCanvasRef.current = null;
    canvasClosedRef.current = null;
  }, [chat.activeId]);

  const handleOpenCanvas = useCallback(
    (artifact: CanvasArtifact, streaming = false) => {
      canvasClosedRef.current = null;
      setCanvasLive(streaming);
      setCanvas(artifact);
    },
    []
  );

  const handleCloseCanvas = useCallback(() => {
    canvasClosedRef.current = canvas?.id ?? null;
    setCanvasLive(false);
    setCanvas(null);
  }, [canvas]);

  useEffect(() => {
    unlockAudioPlayback();
  }, []);

  useEffect(() => {
    const variant: FaviconVariant = liveOpen ? "ocean" : "default";
    applyFavicon(settings.accent ?? DEFAULT_ACCENT, variant);
  }, [liveOpen, settings.accent]);

  useEffect(() => {
    if (!memoryNotice) return;
    const timer = window.setTimeout(() => setMemoryNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [memoryNotice]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/models")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        if (cancelled || typeof data !== "object" || data === null) return;
        const models = (data as Record<string, unknown>).models;
        const fallback = (data as Record<string, unknown>).default;
        if (!Array.isArray(models) || models.length === 0) return;
        setAvailableModels({
          models: models.filter((m): m is string => typeof m === "string"),
          default:
            typeof fallback === "string" ? fallback : (models[0] as string),
          visionFallback:
            (data as Record<string, unknown>).visionFallback === true,
        });
      })
      .catch(() => {
        // Model picker is optional; keep the default when unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [sessionRes, providersRes] = await Promise.all([
          fetch("/api/auth/session"),
          fetch("/api/auth/providers"),
        ]);
        if (cancelled) return;
        if (providersRes.ok) {
          const data: unknown = await providersRes.json();
          if (typeof data === "object" && data !== null) {
            const providers = Object.values(
              data as Record<string, Record<string, unknown>>
            )
              .filter(
                (provider) =>
                  typeof provider.id === "string" &&
                  typeof provider.name === "string"
              )
              .map((provider) => ({
                id: provider.id as string,
                name: provider.name as string,
              }));
            setAuthProviders(providers);
          }
        }
        if (sessionRes.ok) {
          const data: unknown = await sessionRes.json();
          if (typeof data === "object" && data !== null) {
            const user = (data as Record<string, Record<string, unknown>>).user;
            if (
              typeof user === "object" &&
              user !== null &&
              typeof user.name === "string"
            ) {
              setSession({
                name: user.name as string,
                email: typeof user.email === "string" ? (user.email as string) : null,
                image: typeof user.image === "string" ? (user.image as string) : null,
              });
            }
          }
        }
      } catch {
        // Auth is optional; stay signed out when unavailable.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (event.shiftKey && key === "o") {
        event.preventDefault();
        chat.startNewChat();
        setSidebarOpen(false);
      } else if (!event.shiftKey && event.key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chat.startNewChat]);

  const handleEditResend = useCallback(
    (id: string, content: string) => chat.editAndResend(id, content),
    [chat]
  );

  const handleExport = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      conversations: chat.conversations,
      memories: memoryRef.current.map((m) => m.text),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ai-chatbot-data.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }, [chat.conversations]);

  const handleDeleteAll = useCallback(() => {
    chat.deleteAllConversations();
    setSidebarOpen(false);
  }, [chat.deleteAllConversations]);

  const canvasGallery = useMemo(
    () => collectCanvases(chat.conversations),
    [chat.conversations]
  );

  const handleOpenCanvasFromSettings = useCallback(
    (artifact: CanvasArtifact) => {
      setSettingsOpen(false);
      handleOpenCanvas(artifact);
    },
    [handleOpenCanvas]
  );

  const conversation = chat.activeConversation;
  const messages = conversation?.messages ?? [];
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const lastAssistant =
    lastMessage && lastMessage.role === "assistant" && !lastMessage.error
      ? lastMessage
      : null;

  const handleOpenLive = useCallback(() => {
    clearSpeech();
    if (!chat.activeId) chat.startNewChat();
    setLiveOpen(true);
  }, [chat.activeId, chat.startNewChat, clearSpeech]);

  const handleLiveSend = useCallback(
    (text: string) => {
      chat.sendMessage(text);
    },
    [chat.sendMessage]
  );

  const handleExportPdf = useCallback(() => {
    const blocks = Array.from(
      document.querySelectorAll<HTMLElement>("[data-pdf-block]")
    );
    if (blocks.length === 0) return;
    const html = blocks
      .map((block) => {
        const role = block.dataset.messageRole === "user" ? "You" : "Assistant";
        return `<section class="pdf-msg pdf-msg-${role}"><p class="pdf-msg-role">${role}</p>${block.innerHTML}</section>`;
      })
      .join("");
    printPdf(
      conversation?.title ?? "AI Chatbot conversation",
      html,
      `Exported from AI Chatbot · ${formatDate(Date.now())}`
    );
  }, [conversation]);
  const handleExportMarkdown = useCallback(() => {
    if (!conversation) return;
    const lines: string[] = [
      `# ${conversation.title}`,
      "",
      `*Exported from AI Chatbot · ${formatDate(Date.now())}*`,
      "",
    ];
    for (const message of conversation.messages) {
      if (message.error) continue;
      const canvas = findLastCanvas(message.content);
      const body =
        stripCanvasBlocks(message.content).trim() ||
        (canvas ? `[Canvas: ${canvas.title}]` : "");
      if (!body && (message.attachments ?? []).length === 0) continue;
      lines.push(
        message.role === "user" ? "## You" : "## Assistant",
        "",
        body || "*(attachments only)*",
        "",
        `*${formatDate(message.createdAt)}*`,
        "",
        "---",
        ""
      );
    }
    const safe =
      conversation.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) ||
      "chat";
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safe}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [conversation]);

  const busy = chat.status !== "idle";
  const models = availableModels?.models ?? [];
  const currentModel =
    settings.model && models.includes(settings.model)
      ? settings.model
      : (availableModels?.default ?? settings.model ?? "");

  return (
    <div className="relative z-10 flex h-dvh overflow-hidden bg-slate-950 text-slate-100">
      <Sidebar
        conversations={chat.conversations}
        activeId={chat.activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={chat.startNewChat}
        onSelect={chat.selectConversation}
        onRename={chat.renameConversation}
        onTogglePin={chat.togglePin}
        onDelete={chat.deleteConversation}
        session={session}
        providers={authProviders}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex items-center gap-3 border-b border-white/10 bg-slate-900/80 px-4 py-3 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open conversation history"
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-200 lg:hidden"
          >
            <MenuIcon width={18} height={18} />
          </button>
          <h1 className="min-w-0 truncate text-sm font-semibold text-slate-200">
            {conversation ? conversation.title : "AI Chatbot"}
          </h1>
          <ModePicker
            selected={settings.mode}
            onSelect={setChatMode}
            secondary={settings.mode2}
            onSelectSecondary={setChatMode2}
          />
          {models.length > 1 && currentModel && (
            <ModelPicker
              models={models}
              selected={currentModel}
              onSelect={setModel}
            />
          )}
          {busy && (
            <span className="ml-auto shrink-0 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-medium">
              <span className="shimmer-text">Generating…</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
            title="Settings"
            className={`shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-400 ${
              busy || models.length > 1 ? "" : "ml-auto"
            }`}
          >
            <SettingsIcon width={18} height={18} />
          </button>
        </header>

        {messages.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6">
            <div className="flex max-w-lg flex-col items-center text-center">
              <div className="animate-float mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-950/50">
                <BotIcon width={30} height={30} />
              </div>
              <h2 className="gradient-text text-2xl font-bold">
                How can I help you today?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Ask anything — the assistant remembers your conversation and important
                details across chats. You can also attach images and files.
              </p>
              <div className="mt-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion, index) => (
                  <button
                    key={suggestion.title}
                    type="button"
                    onClick={() => chat.sendMessage(suggestion.prompt)}
                    style={{ animationDelay: `${index * 70}ms` }}
                    className="chip-in rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-indigo-400/40 hover:bg-slate-800/80 hover:shadow-[0_10px_28px_-14px_var(--accent-border)] focus-visible:outline-2 focus-visible:outline-indigo-400"
                  >
                    <span className="block text-xs font-semibold text-slate-200">
                      {suggestion.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                      {suggestion.prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ErrorBoundary key={chat.activeId ?? "chat"}>
            <MessageList
              messages={messages}
              status={chat.status}
              canRegenerate={chat.status === "idle"}
              speakingId={speakingId}
              onSpeakToggle={handleSpeakToggle}
              onOpenCanvas={handleOpenCanvas}
              conversationTitle={conversation?.title ?? ""}
              onRegenerate={chat.regenerate}
              onEditResend={handleEditResend}
            />
          </ErrorBoundary>
        )}

        <Composer
          busy={busy}
          onSend={chat.sendMessage}
          onStop={chat.stopGeneration}
          modelSupportsImages={
            supportsVision(currentModel || null) ||
            (availableModels?.visionFallback ?? false)
          }
          onOpenLive={handleOpenLive}
        />
        <p className="bg-slate-950 pb-2 text-center text-[11px] text-slate-500">
          AI can make mistakes. Check important info.
        </p>
      </div>

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onThemeChange={setTheme}
          onAccentChange={setAccent}
          onReadAloudChange={setReadAloud}
          onNaturalVoiceChange={setNaturalVoice}
          memory={{
            enabled: memoryEnabled,
            items: memories,
            onToggle: setMemoryEnabled,
            onRemove: removeMemory,
            onClear: clearMemories,
          }}
          dataControls={{
            onExport: handleExport,
            onExportPdf: handleExportPdf,
            canExportPdf: messages.length > 0 && !busy,
            onExportMarkdown: handleExportMarkdown,
            canExportMarkdown: messages.length > 0 && !busy,
            onDeleteAll: handleDeleteAll,
            canDeleteAll: !busy && chat.conversations.length > 0,
            conversationCount: chat.conversations.length,
          }}
          canvases={canvasGallery}
          onOpenCanvas={handleOpenCanvasFromSettings}
          activity={{
            chats: chat.conversations.length,
            messages: chat.conversations.reduce(
              (total, conversation) => total + conversation.messages.length,
              0
            ),
            canvases: canvasGallery.length,
            memories: memories.length,
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {canvas && (
        <ErrorBoundary>
          <CanvasPanel
            artifact={canvas}
            streaming={canvasLive}
            onClose={handleCloseCanvas}
          />
        </ErrorBoundary>
      )}

      <LiveMode
        open={liveOpen}
        onClose={() => setLiveOpen(false)}
        onSend={handleLiveSend}
        onStop={chat.stopGeneration}
        status={chat.status}
        lastAssistant={lastAssistant}
        naturalVoice={settings.naturalVoice}
      />

      {memoryNotice && (
        <div
          role="status"
          aria-live="polite"
          className="animate-toast-in fixed bottom-24 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium shadow-lg backdrop-blur"
          style={{
            backgroundColor: "var(--accent-badge-bg)",
            borderColor: "var(--accent-border)",
            color: "var(--accent-text)",
          }}
        >
          <SparklesIcon width={13} height={13} className="shrink-0" />
          <span className="truncate">{memoryNotice}</span>
        </div>
      )}
    </div>
  );
}
