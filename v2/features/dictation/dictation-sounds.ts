/**
 * The dictation beeps (Arthur, 25 November 2026: "a beep sound when the
 * dictation starts and when it ends"). Two short notes each, synthesized like
 * the mention chime (runtime/realtime/sound.ts): rising when listening starts,
 * falling when it ends or the message goes. Quiet, about a quarter second.
 *
 * Played only right after a tap (the start) or while the microphone is open
 * (the end), so the browser's autoplay rule allows them. Audio is an extra:
 * any failure is silent.
 */

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  return context;
}

function play(notes: readonly number[]): void {
  try {
    const audio = audioContext();
    if (!audio) return;
    if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
    const t0 = audio.currentTime;
    const gain = audio.createGain();
    gain.connect(audio.destination);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
    notes.forEach((frequency, index) => {
      const tone = audio.createOscillator();
      tone.type = 'sine';
      tone.frequency.setValueAtTime(frequency, t0 + index * 0.09);
      tone.connect(gain);
      tone.start(t0 + index * 0.09);
      tone.stop(t0 + index * 0.09 + 0.12);
    });
  } catch {
    // No sound on this device: dictation goes on.
  }
}

/** Listening started: two rising notes. */
export const START_NOTES = [660, 990] as const;
/** Listening ended (sent or cancelled): two falling notes. */
export const END_NOTES = [990, 660] as const;

export function playStartBeep(): void {
  play(START_NOTES);
}

export function playEndBeep(): void {
  play(END_NOTES);
}
