const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function trapTabKey(
  container: HTMLElement | null,
  event: KeyboardEvent
): void {
  if (!container || event.key !== "Tab") return;
  const focusables = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter(
    (el) =>
      typeof el.checkVisibility !== "function" || el.checkVisibility()
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  const inside = active instanceof Node && container.contains(active);
  if (event.shiftKey) {
    if (active === first || !inside) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last || !inside) {
    event.preventDefault();
    first.focus();
  }
}
