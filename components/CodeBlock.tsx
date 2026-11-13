"use client";

import { useCallback, useRef, useState, type ReactElement, type ReactNode } from "react";
import { CheckIcon, CopyIcon } from "./icons";

function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (typeof node === "object" && "props" in (node as ReactElement)) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    return nodeText(element.props.children);
  }
  return "";
}

export function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    const text = nodeText(children).trim();
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; do nothing.
    }
  }, [children]);

  return (
    <div className="group/code relative">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Code copied" : "Copy code"}
        className="absolute right-2 top-2 z-10 rounded-md border border-white/10 bg-slate-800/90 p-1.5 text-slate-400 opacity-60 transition-all hover:text-slate-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-indigo-400 lg:opacity-0 lg:group-hover/code:opacity-100"
      >
        {copied ? (
          <CheckIcon width={13} height={13} className="text-emerald-400" />
        ) : (
          <CopyIcon width={13} height={13} />
        )}
      </button>
      {children}
    </div>
  );
}
