const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #111827;
    max-width: 800px;
    margin: 40px auto;
    padding: 0 24px;
    line-height: 1.65;
    font-size: 15px;
  }
  h1, h2, h3, h4 { line-height: 1.3; margin: 1.4em 0 0.5em; }
  h1 { font-size: 1.7em; } h2 { font-size: 1.4em; } h3 { font-size: 1.15em; }
  p { margin: 0.6em 0; }
  ul, ol { padding-left: 1.5em; }
  li { margin: 0.25em 0; }
  pre {
    background: #f4f4f5;
    padding: 12px 14px;
    border-radius: 8px;
    overflow-x: auto;
    font-size: 13px;
  }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  p code, li code {
    background: #f4f4f5;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 0.9em;
  }
  table { border-collapse: collapse; margin: 1em 0; width: 100%; }
  th, td { border: 1px solid #d4d4d8; padding: 6px 10px; text-align: left; }
  th { background: #fafafa; }
  blockquote {
    border-left: 3px solid #a1a1aa;
    margin: 1em 0;
    padding: 2px 0 2px 14px;
    color: #52525b;
  }
  a { color: #4f46e5; }
  img { max-width: 100%; }
  hr { border: none; border-top: 1px solid #e4e4e7; margin: 1.5em 0; }
  .pdf-header {
    border-bottom: 1px solid #e4e4e7;
    padding-bottom: 12px;
    margin-bottom: 24px;
  }
  .pdf-header h1 { margin: 0 0 4px; font-size: 1.3em; }
  .pdf-header p { margin: 0; color: #71717a; font-size: 12px; }
  .pdf-msg { margin: 1.4em 0; }
  .pdf-msg-role {
    margin: 0 0 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6d28d9;
  }
  .pdf-msg-user {
    background: #f5f3ff;
    border: 1px solid #ddd6fe;
    border-radius: 10px;
    padding: 10px 14px;
  }
`.trim();

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printPdf(title: string, bodyHtml: string, subtitle: string): void {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
      title
    )}</title><style>${PRINT_STYLES}</style></head><body>` +
      `<div class="pdf-header"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(
        subtitle
      )}</p></div>` +
      bodyHtml +
      `</body></html>`
  );
  win.document.close();
  const print = () => {
    window.setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        // User can still print manually from the opened window.
      }
    }, 300);
  };
  if (win.document.readyState === "complete") {
    print();
  } else {
    win.addEventListener("load", print);
  }
}
