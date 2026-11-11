"use client";

import { useEffect, useRef, useState } from "react";
import type { Conversation } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { ChatIcon, CloseIcon, PencilIcon, PlusIcon, TrashIcon } from "./icons";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function Sidebar({
  conversations,
  activeId,
  open,
  onClose,
  onNewChat,
  onSelect,
  onRename,
  onDelete,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingId) requestAnimationFrame(() => inputRef.current?.select());
  }, [editingId]);

  const normalizedQuery = query.trim().toLowerCase();
  const sorted = [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter(
      (conversation) =>
        normalizedQuery.length === 0 ||
        conversation.title.toLowerCase().includes(normalizedQuery) ||
        conversation.messages.some((message) =>
          message.content.toLowerCase().includes(normalizedQuery)
        )
    );

  const commitRename = (id: string) => {
    onRename(id, draft);
    setEditingId(null);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        aria-label="Conversation history"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-slate-900 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <ChatIcon width={16} height={16} />
            </div>
            <span className="text-sm font-semibold tracking-wide text-slate-100">AI Chatbot</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-200 lg:hidden"
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        <div className="px-3 py-3">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-950/50 transition-all hover:from-indigo-400 hover:to-violet-500 focus-visible:outline-2 focus-visible:outline-indigo-400"
          >
            <PlusIcon width={16} height={16} />
            New chat
          </button>
        </div>

        <div className="px-3 pb-1">
          <label htmlFor="conversation-search" className="sr-only">
            Search conversations
          </label>
          <input
            id="conversation-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats…"
            className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none transition-colors focus:border-indigo-400/60"
          />
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" aria-label="Conversations">
          {sorted.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-slate-500">
              {normalizedQuery.length > 0
                ? "No conversations match your search."
                : "No conversations yet. Start a new chat to begin."}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {sorted.map((conversation) => {
                const isActive = conversation.id === activeId;
                const isEditing = editingId === conversation.id;
                return (
                  <li key={conversation.id}>
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={() => commitRename(conversation.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") commitRename(conversation.id);
                          if (event.key === "Escape") setEditingId(null);
                        }}
                        aria-label="Conversation name"
                        className="w-full rounded-lg border border-indigo-400/50 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none"
                      />
                    ) : (
                      <div
                        className={`group flex items-center gap-1 rounded-lg px-1 transition-colors ${
                          isActive
                            ? "bg-indigo-500/15 ring-1 ring-inset ring-indigo-400/30"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelect(conversation.id);
                            onClose();
                          }}
                          className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left focus-visible:outline-2 focus-visible:outline-indigo-400"
                        >
                          <span
                            className={`block truncate text-sm ${
                              isActive ? "font-medium text-indigo-200" : "text-slate-300"
                            }`}
                          >
                            {conversation.title}
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            {formatDate(conversation.updatedAt)} ·{" "}
                            {conversation.messages.length} messages
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(conversation.id);
                              setDraft(conversation.title);
                            }}
                            aria-label={`Rename conversation: ${conversation.title}`}
                            title="Rename"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-white/10 hover:text-slate-200"
                          >
                            <PencilIcon width={13} height={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete "${conversation.title}"? This cannot be undone.`
                                )
                              ) {
                                onDelete(conversation.id);
                              }
                            }}
                            aria-label={`Delete conversation: ${conversation.title}`}
                            title="Delete"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-300"
                          >
                            <TrashIcon width={13} height={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </aside>
    </>
  );
}
