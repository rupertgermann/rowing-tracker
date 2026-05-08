/**
 * Thin wrapper around `window.speechSynthesis` for speaking coaching-cue
 * audio hints. Cancel-and-replace policy: a new cue interrupts whatever is
 * currently speaking so the rower never hears stacked stale advice.
 */

export interface SpeakCueOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

export function isSpeechSynthesisAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined" &&
    typeof window.SpeechSynthesisUtterance !== "undefined"
  );
}

export function speakCue(text: string, opts: SpeakCueOptions = {}): void {
  if (!text || !isSpeechSynthesisAvailable()) return;
  const synth = window.speechSynthesis;
  try {
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = opts.rate ?? 1.05;
    utter.pitch = opts.pitch ?? 1;
    utter.volume = opts.volume ?? 1;
    if (opts.lang) utter.lang = opts.lang;
    synth.speak(utter);
  } catch {
    // Speech synthesis is best-effort; never let it break the capture loop.
  }
}

export function cancelSpokenCues(): void {
  if (!isSpeechSynthesisAvailable()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}
