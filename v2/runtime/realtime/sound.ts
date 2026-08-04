/**
 * sound — the mention chime. Spec: foundation-standards §5 ("one short sound,
 * ≤300ms, coalesced per channel per ~10s") + owner decision D8 (off by
 * default — the dispatcher checks the preference; this module only plays).
 *
 * SYNTHESIZED, NOT AN ASSET: a two-note WebAudio chime (~260ms) keeps the
 * bundle free of an audio file and needs no fetch at notify time. Everything
 * is wrapped in feature detection + try/catch because audio is an enhancement:
 * an AudioContext that the autoplay policy keeps suspended simply stays
 * silent — never an error, never a retry loop.
 *
 * COALESCING lives HERE (not in the dispatcher) so every caller shares one
 * ledger: at most one chime per channel per {@link SOUND_COALESCE_MS}, however
 * many mention events land in the burst.
 */

const SOUND_COALESCE_MS = 10_000;

/** channel uuid → epoch ms of the last chime actually played. */
const lastPlayedAt = new Map<string, number>();

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  audioContext ??= new Ctor();
  return audioContext;
}

/**
 * Play the mention chime for a channel, coalesced. Safe to call from any
 * event handler; no-ops on the server, without WebAudio, or inside the
 * coalescing window.
 */
export function playMentionChime(channelUuid: string): void {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  const last = lastPlayedAt.get(channelUuid) ?? 0;
  if (now - last < SOUND_COALESCE_MS) return;
  lastPlayedAt.set(channelUuid, now);

  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === 'suspended') {
      // Autoplay policy: resumable only after a user gesture. If it stays
      // suspended the scheduled notes never sound — the acceptable failure.
      void context.resume().catch(() => undefined);
    }

    const t0 = context.currentTime;
    const gain = context.createGain();
    gain.connect(context.destination);
    // Quiet envelope: fast attack, exponential release — a chime, not an alarm.
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.1, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);

    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    // A5 → D6: a gentle upward two-note figure, 260ms total (≤300ms budget).
    oscillator.frequency.setValueAtTime(880, t0);
    oscillator.frequency.setValueAtTime(1174.66, t0 + 0.1);
    oscillator.connect(gain);
    oscillator.start(t0);
    oscillator.stop(t0 + 0.26);
  } catch {
    // Audio is optional by design — never surface a failure for a chime.
  }
}
