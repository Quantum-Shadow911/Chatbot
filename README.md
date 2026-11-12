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
| `MISTRAL_API_KEY`  | — (required)             | Server-side API key for your provider      |
| `MISTRAL_API_URL`  | `https://api.mistral.ai` | API base URL of your provider              |
| `MISTRAL_MODEL`    | `mistral-small-latest`   | Chat model to use                          |
| `MISTRAL_MODELS`   | — (optional)             | Comma-separated extra models for the header picker (auto-discovered from the provider when unset) |
| `VISION_API_KEY`   | — (optional)             | API key for the vision fallback provider   |
| `VISION_MODEL`     | — (optional)             | Vision-capable model for image messages    |
| `VISION_API_URL`   | `https://api.mistral.ai` | API base URL of the vision fallback        |
| `AUTH_SECRET`      | — (optional)             | Secret for signing sessions (`openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID`   | — (optional)             | Google OAuth client ID                     |
| `AUTH_GOOGLE_SECRET` | — (optional)           | Google OAuth client secret                 |
| `AUTH_APPLE_ID`    | — (optional)             | Apple Services ID (Apple Developer needed) |
| `AUTH_APPLE_SECRET` | — (optional)            | Apple client secret JWT                    |

### Image understanding (vision fallback)

If your main provider has no vision-capable model (e.g. Groq's text-only
catalog), add a vision fallback and image messages are routed there
automatically while everything else keeps using your main provider:

```bash
# e.g. Mistral's Pixtral — https://console.mistral.ai/api-keys
VISION_API_KEY=your_mistral_key
VISION_MODEL=pixtral-12b-2409
# VISION_API_URL=https://api.mistral.ai  (default)
```

The header model picker lists your provider's catalog (auto-discovered via
`/v1/models`) plus the vision model. Image uploads are downscaled client-side
and sent as OpenAI-style `image_url` parts.

### Using a different provider

The chat API route speaks the standard OpenAI-compatible format, so any
OpenAI-compatible provider works without code changes:

```bash
# Groq (free tier) — https://console.groq.com/keys
MISTRAL_API_KEY=gsk_your_groq_key
MISTRAL_API_URL=https://api.groq.com/openai/v1
MISTRAL_MODEL=openai/gpt-oss-20b

# Local Ollama — https://ollama.com
MISTRAL_API_KEY=ollama
MISTRAL_API_URL=http://localhost:11434/v1
MISTRAL_MODEL=llama3.2
```

Model names change over time as providers retire old models — if you get a
"model not found" style error, check your provider's current model list.
The app surfaces the provider's real error message in the chat to make this
easy to diagnose.

### Sign-in with Google / Apple

Sign-in is optional. Each provider appears in the sidebar once both of its
variables are set:

1. Set `AUTH_SECRET` in your deployment (`openssl rand -base64 32`).
2. **Google** (free): create an OAuth client at
   [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials),
   add `<your-app-url>/api/auth/callback/google` as an authorized redirect URI,
   then set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
3. **Apple** (requires the paid Apple Developer Program): register a Services ID
   and key at [developer.apple.com/account](https://developer.apple.com/account),
   add `<your-app-url>/api/auth/callback/apple` as a return URL, then set
   `AUTH_APPLE_ID` and `AUTH_APPLE_SECRET` (a client-secret JWT).

Signing in identifies the user in the sidebar; chat history stays on the device.

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

Includes a favicon served from `app/icon.svg`.
