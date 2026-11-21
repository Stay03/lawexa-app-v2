import type { VoiceTestMode } from '@/types/voice-test';
import { emitVoiceResearchReady } from './voice-events';
import { RESEARCH_MARKER_PREFIX } from './voice-model';
import type { VoiceCallHandlers, VoiceCallStart, VoiceSession } from './voice-session';

/**
 * The stand-in call, until the ElevenLabs client is added (Stay's yes on the
 * package is pending; the Techlead, 21 November 2026). No microphone and no
 * sound: a short scripted conversation that moves the page the way a real
 * call does, so the screen, the transcript and the delay table can be built
 * and pictured. The page says plainly that it is a practice call.
 *
 * On a `c` call the second question needs research: the agent says its
 * holding line, the server's `.voice.research_ready` is played through the
 * same event bus the real one uses, and the answer follows the marker the
 * page sends back.
 */

interface ScriptTurn {
  you: string;
  lawexa: string;
  /** Seconds before the agent's first sound. */
  delay: number;
  research?: { holding: string; answer: string; seconds: number };
}

const GREETING = 'Hello, I’m Lawexa. What would you like to talk through?';

const SCRIPT: ScriptTurn[] = [
  {
    you: 'TEST DATA. My landlord pasted a quit notice on my door. Is that valid service?',
    lawexa: '[thoughtful] Under the Lagos State Tenancy Law a notice should be served personally, or as the tenancy agreement says. Pasting is not one of those unless the agreement allows it.',
    delay: 1.1,
  },
  {
    you: 'TEST DATA. Is there a case that says so?',
    lawexa: 'Ehen... let me check that.',
    delay: 0.7,
    research: {
      holding: 'Ehen... let me check that.',
      answer: 'I found two Court of Appeal decisions that treat a notice not served as the law or the agreement requires as invalid. I have put them in your chat with the citations.',
      seconds: 4.2,
    },
  },
  {
    you: 'TEST DATA. Thank you, that helps.',
    lawexa: 'You’re welcome. Send me the tenancy agreement when you have it and I’ll check the service clause.',
    delay: 0.9,
  },
];

const SPEAK_MS_PER_CHAR = 55;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class PracticeVoiceSession implements VoiceSession {
  readonly practice = true;
  /** A `b` call answers research in one go: ElevenLabs runs the case search itself, with no marker. */
  private readonly mode: VoiceTestMode;
  private handlers: VoiceCallHandlers | null = null;
  private sessionUuid = '';
  private live = false;
  private id: string | null = null;
  private waitingForMarker: ((marker: string) => void) | null = null;

  constructor(mode: VoiceTestMode) {
    this.mode = mode;
  }

  async start(options: VoiceCallStart, handlers: VoiceCallHandlers): Promise<void> {
    this.handlers = handlers;
    this.sessionUuid = options.customLlmExtraBody.session_uuid ?? '';
    this.live = true;
    handlers.onStatus('connecting');
    await sleep(700);
    if (!this.live) return;
    this.id = `practice-${this.sessionUuid.slice(0, 8)}`;
    handlers.onStatus('connected');
    void this.play();
  }

  async end(): Promise<void> {
    this.live = false;
    this.waitingForMarker = null;
    this.handlers?.onStatus('disconnected');
  }

  setMuted(): void {
    // Nothing to mute: the practice call uses no microphone.
  }

  sendUserMessage(text: string): void {
    if (text.startsWith(RESEARCH_MARKER_PREFIX)) this.waitingForMarker?.(text);
  }

  conversationId(): string | null {
    return this.id;
  }

  private async say(text: string) {
    if (!this.live || !this.handlers) return;
    this.handlers.onMode('speaking');
    this.handlers.onMessage({ source: 'ai', text });
    await sleep(Math.min(6000, text.length * SPEAK_MS_PER_CHAR));
    if (this.live) this.handlers.onMode('listening');
  }

  private async play() {
    await this.say(GREETING);
    let turn = 0;
    for (const step of SCRIPT) {
      turn += 1;
      await sleep(2200);
      if (!this.live || !this.handlers) return;
      this.handlers.onMessage({ source: 'user', text: step.you });
      await sleep(step.delay * 1000);
      if (!step.research) {
        await this.say(step.lawexa);
        continue;
      }
      if (this.mode === 'b') {
        await sleep(step.research.seconds * 1000);
        await this.say(step.research.answer);
        continue;
      }
      await this.say(step.research.holding);
      const marker = `${RESEARCH_MARKER_PREFIX}practice-${turn}]]`;
      const sent = new Promise<string>((resolve) => {
        this.waitingForMarker = resolve;
      });
      await sleep(step.research.seconds * 1000);
      if (!this.live) return;
      emitVoiceResearchReady({ session_uuid: this.sessionUuid, turn_uuid: `practice-${turn}`, marker });
      await sent;
      this.waitingForMarker = null;
      await sleep(600);
      await this.say(step.research.answer);
    }
  }
}
