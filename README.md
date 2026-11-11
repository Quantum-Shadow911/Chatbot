# AI Chatbot

A modern, fully functional AI chatbot built with Next.js 15, React 19, TypeScript, and Tailwind CSS, powered by the Mistral chat completions API with server-sent-event streaming.

## Features

- **Real AI integration** — streams token-by-token responses from the Mistral API; the API key lives only in a server-side environment variable and is never exposed to the browser.
- **Streaming responses** with a typing indicator, plus a stop button to cancel generation.
- **Conversational context** — the full message history is sent with every request, so follow-up questions work naturally.
- **Conversation management** — sidebar with new chat, inline rename, delete (with confirmation), and automatic titles from the first message.
- **Persistence** — conversations and the active chat survive page refreshes via `localStorage`.
- **Message actions** — copy AI responses, regenerate the last response, and edit & resend any of your messages (truncates the rest of the thread).
- **Rich formatting** — Markdown with headings, lists, tables, and syntax-highlighted code blocks.
- **Polished UX** — timestamps, smooth animations, stick-to-bottom auto-scroll with a jump-to-latest button, graceful error bubbles with retry, and rate-limit/network error handling.
- **Responsive & accessible** — collapsible sidebar on mobile, keyboard navigation (Enter to send, Shift+Enter for newline, Escape to cancel edits), ARIA labels, and reduced-motion support.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure the API key (server-side only — never bundled into client code):

   ```bash
   cp .env.example .env.local
   # then edit .env.local and set MISTRAL_API_KEY=...
   ```

   Get a key at [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys).

3. Run the app:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Production build

```bash
npm run build
npm start
```

## Configuration

| Variable           | Default                  | Purpose                                    |
| ------------------ | ------------------------ | ------------------------------------------ |
| `MISTRAL_API_KEY`  | — (required)             | Server-side Mistral API key                |
| `MISTRAL_API_URL`  | `https://api.mistral.ai` | API base URL (useful for proxies/testing)  |
| `MISTRAL_MODEL`    | `mistral-small-latest`   | Chat model to use                          |

## Project structure

```
app/
  api/chat/route.ts    # Streaming proxy to the Mistral API (key stays server-side)
  layout.tsx           # Root layout and metadata
  page.tsx             # Chat page
  globals.css          # Tailwind theme, animations, markdown styles
components/
  ChatApp.tsx          # App shell and layout
  Sidebar.tsx          # Conversation history, rename, delete
  MessageList.tsx      # Scrolling message log with auto-scroll
  MessageBubble.tsx    # Message bubbles, actions, inline edit
  Composer.tsx         # Input area, Enter/Shift+Enter, send/stop
  Markdown.tsx         # Markdown + syntax highlighting renderer
  CopyButton.tsx       # Clipboard button with feedback
  TypingIndicator.tsx  # Animated typing dots
  icons.tsx            # Inline SVG icons
hooks/
  useChat.ts           # State management, streaming, persistence
lib/
  types.ts             # Shared types
  storage.ts           # localStorage load/save with validation
  utils.ts             # IDs, date formatting, title generation
```
