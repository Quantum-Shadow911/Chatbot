export interface VoiceOption {
  uri: string;
  name: string;
  lang: string;
}

const MAX_SPEECH_LENGTH = 4000;

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

export function speak(
  text: string,
  options: { voiceURI: string | null; rate: number; onEnd?: () => void }
): boolean {
  if (!speechSupported()) return false;
  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(
    stripMarkdownForSpeech(text).slice(0, MAX_SPEECH_LENGTH)
  );
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

export function stopSpeaking(): void {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
}
