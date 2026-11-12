interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternativeLike;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  item(index: number): SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed"]);

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return (
    typeof w.SpeechRecognition === "function" ||
    typeof w.webkitSpeechRecognition === "function"
  );
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  if (typeof w.SpeechRecognition === "function") {
    return w.SpeechRecognition as SpeechRecognitionCtor;
  }
  if (typeof w.webkitSpeechRecognition === "function") {
    return w.webkitSpeechRecognition as SpeechRecognitionCtor;
  }
  return null;
}

export interface RecognizerHandlers {
  onFinal: (text: string) => void;
  onInterim: (text: string) => void;
  onError: (message: string) => void;
}

export interface Recognizer {
  start: () => void;
  stop: () => void;
}

export function createRecognizer(handlers: RecognizerHandlers): Recognizer {
  let recognition: SpeechRecognitionLike | null = null;
  let running = false;

  const ensure = (): SpeechRecognitionLike | null => {
    if (recognition) return recognition;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const trimmed = text.trim();
          if (trimmed) handlers.onFinal(trimmed);
        } else {
          interim += text;
        }
      }
      handlers.onInterim(interim.trim());
    };
    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (FATAL_ERRORS.has(event.error)) {
        running = false;
        handlers.onError(
          "Microphone access is blocked. Allow mic permission for this site, then tap the mic to try again."
        );
        return;
      }
      if (event.error === "language-not-supported") {
        running = false;
        handlers.onError(
          "Speech recognition doesn't support this browser language. Try switching your browser to English."
        );
        return;
      }
      if (event.error === "network") {
        handlers.onError(
          "Speech recognition hit a network problem. Check your connection."
        );
      }
    };
    rec.onend = () => {
      if (!running) return;
      window.setTimeout(() => {
        if (!running) return;
        try {
          rec.start();
        } catch {
          // start() throws if the engine is still stopping; onend fires again.
        }
      }, 120);
    };
    recognition = rec;
    return rec;
  };

  return {
    start: () => {
      const rec = ensure();
      if (!rec || running) return;
      running = true;
      try {
        rec.start();
      } catch {
        // Already started or still stopping; onend keeps it alive.
      }
    },
    stop: () => {
      running = false;
      if (!recognition) return;
      try {
        recognition.stop();
      } catch {
        // Ignore stop races.
      }
      try {
        recognition.abort();
      } catch {
        // Ignore abort races.
      }
    },
  };
}

export interface MicMeter {
  start: () => Promise<boolean>;
  stop: () => void;
}

export function createMicMeter(onLevel: (level: number) => void): MicMeter | null {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return null;
  }

  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let frame = 0;
  let running = false;

  const tick = () => {
    if (!running || !analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    onLevel(Math.min(1, rms * 4));
    frame = window.requestAnimationFrame(tick);
  };

  return {
    start: async () => {
      if (running) return true;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        const Ctx: typeof AudioContext | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return false;
        context = new Ctx();
        const source = context.createMediaStreamSource(stream);
        analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        running = true;
        frame = window.requestAnimationFrame(tick);
        return true;
      } catch {
        stop();
        return false;
      }
    },
    stop: () => {
      running = false;
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      try {
        stream?.getTracks().forEach((track) => track.stop());
      } catch {
        // Ignore track races.
      }
      stream = null;
      try {
        void context?.close();
      } catch {
        // Ignore close races.
      }
      context = null;
      analyser = null;
      onLevel(0);
    },
  };
}
