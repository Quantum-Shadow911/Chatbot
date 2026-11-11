"use client";

import { useCallback, useEffect, useState } from "react";
import { useChat } from "@/hooks/useChat";
import { useSettings } from "@/hooks/useSettings";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { SettingsModal } from "./SettingsModal";
import { Sidebar } from "./Sidebar";
import { BotIcon, MenuIcon, SettingsIcon } from "./icons";

export function ChatApp() {
  const chat = useChat();
  const { settings, setTheme, setAccent } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (sidebarOpen) {
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") setSidebarOpen(false);
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [sidebarOpen]);

  const handleEditResend = useCallback(
    (id: string, content: string) => chat.editAndResend(id, content),
    [chat]
  );

  const conversation = chat.activeConversation;
  const messages = conversation?.messages ?? [];
  const busy = chat.status !== "idle";

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-950 text-slate-100">
      <Sidebar
        conversations={chat.conversations}
        activeId={chat.activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={chat.startNewChat}
        onSelect={chat.selectConversation}
        onRename={chat.renameConversation}
        onDelete={chat.deleteConversation}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-white/10 bg-slate-900/80 px-4 py-3 backdrop-blur sm:px-6">
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
          {busy && (
            <span className="ml-auto shrink-0 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-medium text-indigo-300">
              Generating…
            </span>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
            title="Settings"
            className={`shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-400 ${
              busy ? "" : "ml-auto"
            }`}
          >
            <SettingsIcon width={18} height={18} />
          </button>
        </header>

        {messages.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6">
            <div className="flex max-w-md flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-950/50">
                <BotIcon width={30} height={30} />
              </div>
              <h2 className="text-xl font-semibold text-slate-100">How can I help you today?</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Ask anything — the assistant remembers the conversation, so you can ask
                follow-up questions without repeating context. You can also attach images
                and files.
              </p>
            </div>
          </div>
        ) : (
          <MessageList
            messages={messages}
            status={chat.status}
            canRegenerate={chat.status === "idle"}
            onRegenerate={chat.regenerate}
            onEditResend={handleEditResend}
          />
        )}

        <Composer busy={busy} onSend={chat.sendMessage} onStop={chat.stopGeneration} />
      </div>

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onThemeChange={setTheme}
          onAccentChange={setAccent}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
