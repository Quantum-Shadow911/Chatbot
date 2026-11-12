export type Role = "user" | "assistant";

export type AttachmentKind = "image" | "text" | "file";

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: AttachmentKind;
  dataUrl?: string;
  text?: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  error?: boolean;
  reasoning?: string;
  attachments?: Attachment[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatRequestMessage {
  role: Role;
  content: string | ContentPart[];
}

export interface ChatRequest {
  messages: ChatRequestMessage[];
}

export interface AuthProviderInfo {
  id: string;
  name: string;
}

export interface SessionInfo {
  name: string | null;
  email: string | null;
  image: string | null;
}
