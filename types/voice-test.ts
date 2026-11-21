/**
 * The staff live-voice test page (thread ac47b1df; Backend's server half
 * fe2736bd, shapes of 21 November 2026). Staff only (`user.can_record`).
 *
 * Two ways to answer, picked per call:
 * - `c`: Lawexa in the middle. ElevenLabs hears and speaks; Lawexa's own model
 *   writes every answer, and says a short line at once when it has to research.
 * - `b`: ElevenLabs' own model answers, with Lawexa's case search as its tool.
 */
export type VoiceTestMode = 'c' | 'b';

export interface VoiceOption {
  id: string;
  name: string;
}

/** `POST /voice-test/sessions` → 201. */
export interface VoiceTestSession {
  session_uuid: string;
  mode: VoiceTestMode;
  agent_id: string;
  /** Single use, for the ElevenLabs client's WebRTC call. */
  conversation_token: string;
  voice_id: string;
  voices: VoiceOption[];
  /** Passed to the call as its user id, so the server knows whose turns these are. */
  user_id: string;
  /** Passed to the call unchanged: it carries the session to Lawexa's server on every turn. */
  custom_llm_extra_body: { session_uuid: string };
  conversation_uuid: string | null;
}

/**
 * `.voice.research_ready` on `private-users.{uuid}`: a `c` call's research is
 * done. The page sends `marker` on the call as a user message and Lawexa
 * speaks the answer.
 */
export interface VoiceResearchReadyEvent {
  session_uuid: string;
  turn_uuid: string;
  marker: string;
}

/** One turn of a `c` call, as the server timed it (`GET /voice-test/sessions/{uuid}/turns`). */
export interface VoiceServerTurn {
  uuid: string;
  user_text: string;
  kind: 'answer' | 'research';
  /** The answer without its audio tags. */
  answer_text: string;
  tags: string[];
  received_at: string | null;
  first_text_at: string | null;
  filler_sent_at: string | null;
  research_started_at: string | null;
  research_done_at: string | null;
  research_spoken_at: string | null;
  first_text_ms: number | null;
  research_ms: number | null;
}

export interface VoiceServerTurns {
  session_uuid: string;
  mode: VoiceTestMode;
  turns: VoiceServerTurn[];
}
