export type ThemeMode = "light" | "dark" | "system";

export interface Settings {
  theme: ThemeMode;
  accent: string | null;
}

export const DEFAULT_SETTINGS: Settings = { theme: "system", accent: null };
export const DEFAULT_ACCENT = "#6366f1";

export const ACCENT_PRESETS: { name: string; hex: string }[] = [
  { name: "Red", hex: "#ef4444" },
  { name: "Orange", hex: "#f97316" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Yellow", hex: "#eab308" },
  { name: "Lime", hex: "#84cc16" },
  { name: "Green", hex: "#22c55e" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Sky", hex: "#0ea5e9" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Fuchsia", hex: "#d946ef" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Rose", hex: "#f43f5e" },
];

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function isValidAccent(value: unknown): value is string {
  return typeof value === "string" && HEX_PATTERN.test(value);
}

export function isValidThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function normalizeSettings(value: unknown): Settings {
  if (typeof value !== "object" || value === null) return { ...DEFAULT_SETTINGS };
  const raw = value as Record<string, unknown>;
  return {
    theme: isValidThemeMode(raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme,
    accent: isValidAccent(raw.accent) ? raw.accent.toLowerCase() : null,
  };
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function hexToHsl(hex: string): Hsl {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hslToHex({ h, s, l }: Hsl): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  const segment = Math.floor(hue / 60) % 6;
  const table: [number, number, number][] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ];
  const [r, g, b] = table[segment].map((channel) =>
    Math.round((channel + m) * 255)
  );
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function shift(hex: string, dl: number, ds = 0): string {
  const hsl = hexToHsl(hex);
  return hslToHex({
    h: hsl.h,
    s: clamp(hsl.s + ds, 0, 100),
    l: clamp(hsl.l + dl, 0, 100),
  });
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applyTheme(settings: Settings): void {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = settings.theme === "dark" || (settings.theme === "system" && prefersDark);
  root.classList.toggle("light", !dark);

  const accent = settings.accent ?? DEFAULT_ACCENT;
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--accent-strong", shift(accent, dark ? -10 : -14));
  root.style.setProperty("--accent-soft", shift(accent, dark ? 12 : 8));
  root.style.setProperty("--accent-text", dark ? shift(accent, 26, -5) : shift(accent, -22, 5));
  root.style.setProperty("--accent-border", withAlpha(accent, dark ? 0.4 : 0.45));
  root.style.setProperty("--accent-badge-bg", withAlpha(accent, dark ? 0.12 : 0.1));
}
