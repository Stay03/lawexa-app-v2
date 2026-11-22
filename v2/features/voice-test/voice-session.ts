/**
 * A voice call, whichever client carries it (thread ac47b1df). The page talks
 * only to this; `elevenlabs-voice-session.ts` carries it over ElevenLabs'
 * web client (WebRTC).
 *
 * The shape follows the ElevenLabs client's own: a status, the agent speaking
 * or listening, a message per finished line from either side, mute, a user
 * message sent as text, and the provider's id for the call.
 */

export type VoiceCallStatus = 'connecting' | 'connected' | 'disconnected';

/** Who is talking: the agent speaking, or listening to the person. */
export type VoiceCallMode = 'speaking' | 'listening';

export interface VoiceCallMessage {
  /** `user`: the person's words, once heard in full. `ai`: a line the agent says. */
  source: 'user' | 'ai';
  text: string;
}

export interface VoiceCallHandlers {
  onStatus: (status: VoiceCallStatus) => void;
  onMode: (mode: VoiceCallMode) => void;
  onMessage: (message: VoiceCallMessage) => void;
  /** The call failed or was refused; a sentence the page can show. */
  onError: (message: string) => void;
  /** How likely the caller is speaking right now, 0 to 1 (the client's voice activity score). */
  onVad?: (score: number) => void;
}

export interface VoiceCallStart {
  conversationToken: string;
  /** The server's user id for the call. */
  userId: string;
  /** Sent with every turn to Lawexa's server, unchanged: it names the session. */
  customLlmExtraBody: Record<string, string>;
  /** The voice, as an override on the agent's text-to-speech. */
  voiceId: string;
  /** An `a` call's dynamic variables, passed to the agent as they are. */
  dynamicVariables?: Record<string, string>;
}

export interface VoiceSession {
  start: (options: VoiceCallStart, handlers: VoiceCallHandlers) => Promise<void>;
  end: () => Promise<void>;
  setMuted: (muted: boolean) => void;
  /** A line sent as if the person said it (the research marker on a `c` call). */
  sendUserMessage: (text: string) => void;
  /** The provider's id for this call, once connected. */
  conversationId: () => string | null;
}
