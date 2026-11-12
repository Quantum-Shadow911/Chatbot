export interface NaturalVoice {
  id: string;
  name: string;
}

export interface NaturalTtsInfo {
  available: boolean;
  groqReady: boolean;
  voices: NaturalVoice[];
  default: string | null;
}

const MAX_SPEECH_LENGTH = 4000;
const AUDIO_CACHE_LIMIT = 40;

const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{2022}\u{25A0}-\u{25FF}\u{E0020}-\u{E007F}]/gu;

export function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?(```|$)/g, " Code block omitted. ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*[-=]{3,}\s*$/gm, "")
    .replace(/[*_~`>|]/g, "")
    .replace(EMOJI_PATTERN, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

let neuralInfoPromise: Promise<NaturalTtsInfo> | null = null;

export function naturalTtsInfo(): Promise<NaturalTtsInfo> {
  if (!neuralInfoPromise) {
    neuralInfoPromise = fetch("/api/tts")
      .then((response) =>
        response.ok
          ? response.json()
          : { available: false, groqReady: false, voices: [], default: null }
      )
      .catch(() => {
        neuralInfoPromise = null;
        return { available: false, groqReady: false, voices: [], default: null };
      });
  }
  return neuralInfoPromise;
}

const audioCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;
let speechEpoch = 0;

let audioUnlocked = false;

function silentWavUrl(): string {
  const sampleRate = 8000;
  const samples = 800;
  const buffer = new ArrayBuffer(44 + samples);
  const view = new DataView(buffer);
  const writeStr = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeStr(36, "data");
  view.setUint32(40, samples, true);
  for (let i = 0; i < samples; i += 1) view.setUint8(44 + i, 128);
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export function unlockAudioPlayback(): void {
  if (typeof window === "undefined" || audioUnlocked) return;
  const unlock = () => {
    if (audioUnlocked) return;
    audioUnlocked = true;
    const silent = new Audio(silentWavUrl());
    silent.volume = 0;
    void silent.play().catch(() => {});
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("touchend", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

function cacheAudio(key: string, url: string): void {
  if (audioCache.size >= AUDIO_CACHE_LIMIT) {
    const oldest = audioCache.keys().next().value;
    if (oldest !== undefined) audioCache.delete(oldest);
  }
  audioCache.set(key, url);
}

async function playNeural(
  text: string,
  voice: string | null,
  onEnd: (() => void) | undefined,
  epoch: number
): Promise<boolean> {
  const key = `${voice ?? "default"}::${text}`;
  let url = audioCache.get(key);
  if (!url) {
    let response: Response;
    try {
      response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });
    } catch {
      return false;
    }
    if (!response.ok) return false;
    const blob = await response.blob().catch(() => null);
    if (!blob) return false;
    url = URL.createObjectURL(blob);
    cacheAudio(key, url);
  }
  if (epoch !== speechEpoch) return true;
  const audio = new Audio(url);
  audio.preload = "auto";
  const finish = () => {
    if (currentAudio === audio) currentAudio = null;
    if (epoch === speechEpoch) onEnd?.();
  };
  audio.onended = finish;
  audio.onerror = finish;
  currentAudio = audio;
  try {
    await audio.play();
  } catch {
    finish();
  }
  return true;
}

export function speak(
  text: string,
  options: { naturalVoice?: string | null; onEnd?: () => void }
): boolean {
  const clean = stripMarkdownForSpeech(text).slice(0, MAX_SPEECH_LENGTH);
  if (!clean) {
    options.onEnd?.();
    return false;
  }
  stopSpeaking();
  const epoch = speechEpoch;
  void (async () => {
    const info = await naturalTtsInfo();
    if (epoch !== speechEpoch) return;
    if (info.available) {
      const played = await playNeural(
        clean,
        options.naturalVoice ?? info.default,
        options.onEnd,
        epoch
      );
      if (played) return;
    }
    if (epoch !== speechEpoch) return;
    options.onEnd?.();
  })();
  return true;
}

export function stopSpeaking(): void {
  speechEpoch += 1;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute("src");
    currentAudio = null;
  }
}
