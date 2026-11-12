export interface VoiceOption {
  uri: string;
  name: string;
  lang: string;
}

export interface NaturalVoice {
  id: string;
  name: string;
}

export interface NaturalTtsInfo {
  available: boolean;
  voices: NaturalVoice[];
  default: string | null;
}

const MAX_SPEECH_LENGTH = 4000;
const AUDIO_CACHE_LIMIT = 40;

const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{2022}\u{25A0}-\u{25FF}\u{E0020}-\u{E007F}]/gu;

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function listVoices(): VoiceOption[] {
  if (!speechSupported()) return [];
  return window.speechSynthesis.getVoices().map((voice) => ({
    uri: voice.voiceURI,
    name: voice.name,
    lang: voice.lang,
  }));
}

export function onVoicesChanged(callback: () => void): () => void {
  if (!speechSupported()) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", callback);
  return () =>
    window.speechSynthesis.removeEventListener("voiceschanged", callback);
}

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
          : { available: false, voices: [], default: null }
      )
      .catch(() => {
        neuralInfoPromise = null;
        return { available: false, voices: [], default: null };
      });
  }
  return neuralInfoPromise;
}

const audioCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;

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
  onEnd?: () => void
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
  const audio = new Audio(url);
  const finish = () => {
    if (currentAudio === audio) currentAudio = null;
    onEnd?.();
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

async function speakWithNatural(
  text: string,
  options: {
    voiceURI: string | null;
    naturalVoice?: string | null;
    rate: number;
    onEnd?: () => void;
  }
): Promise<void> {
  const info = await naturalTtsInfo();
  if (info.available) {
    const played = await playNeural(
      text,
      options.naturalVoice ?? info.default,
      options.onEnd
    );
    if (played) return;
  }
  if (!speakBrowser(text, options)) options.onEnd?.();
}

function speakBrowser(
  text: string,
  options: { voiceURI: string | null; rate: number; onEnd?: () => void }
): boolean {
  if (!speechSupported()) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  if (options.voiceURI) {
    const voice = window.speechSynthesis
      .getVoices()
      .find((candidate) => candidate.voiceURI === options.voiceURI);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
  }
  utterance.rate = options.rate;
  if (options.onEnd) {
    utterance.onend = options.onEnd;
    utterance.onerror = options.onEnd;
  }
  window.speechSynthesis.speak(utterance);
  return true;
}

export function speak(
  text: string,
  options: {
    voiceURI: string | null;
    naturalVoice?: string | null;
    rate: number;
    onEnd?: () => void;
  }
): boolean {
  const clean = stripMarkdownForSpeech(text).slice(0, MAX_SPEECH_LENGTH);
  if (!clean) {
    options.onEnd?.();
    return false;
  }
  stopSpeaking();
  void speakWithNatural(clean, options);
  return true;
}

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute("src");
    currentAudio = null;
  }
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
}
