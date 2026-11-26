export type InterfaceMode = "agency" | "unstable" | "override";

export type SteveSpeechOptions = {
  mode?: InterfaceMode;
  voiceHint?: string;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: SpeechSynthesisErrorEvent) => void;
};

type SpeechProfile = {
  rate: number;
  pitch: number;
};

const profiles: Record<InterfaceMode, SpeechProfile> = {
  agency: { rate: 0.94, pitch: 0.92 },
  unstable: { rate: 1.02, pitch: 0.82 },
  override: { rate: 0.82, pitch: 0.58 }
};

export function canUseSteveSpeech(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function stopSteveSpeech(): void {
  if (canUseSteveSpeech()) {
    window.speechSynthesis.cancel();
  }
}

export async function speakSteve(text: string, options: SteveSpeechOptions = {}): Promise<void> {
  if (!canUseSteveSpeech()) {
    throw new Error("Speech synthesis is not available in this browser.");
  }

  const mode = options.mode ?? "agency";
  const profile = profiles[mode];
  const utterance = new SpeechSynthesisUtterance(text);

  utterance.rate = profile.rate;
  utterance.pitch = profile.pitch;
  utterance.volume = options.volume ?? 1;
  utterance.voice = await selectVoice(options.voiceHint ?? "David");

  return new Promise((resolve, reject) => {
    utterance.onstart = () => options.onStart?.();
    utterance.onend = () => {
      options.onEnd?.();
      resolve();
    };
    utterance.onerror = (event) => {
      options.onError?.(event);
      reject(event.error);
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

async function selectVoice(voiceHint: string): Promise<SpeechSynthesisVoice | null> {
  const voices = await getVoices();
  const normalizedHint = voiceHint.toLowerCase();

  return (
    voices.find((voice) => voice.name.toLowerCase().includes(normalizedHint)) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
    voices[0] ??
    null
  );
}

function getVoices(): Promise<SpeechSynthesisVoice[]> {
  const voices = window.speechSynthesis.getVoices();

  if (voices.length > 0) {
    return Promise.resolve(voices);
  }

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);

    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timeout);
      resolve(window.speechSynthesis.getVoices());
    };
  });
}
