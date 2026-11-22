/**
 * The staff live-voice test page (thread ac47b1df; Backend's server half
 * fe2736bd, shapes of 21 November 2026). Staff only (`user.can_record`).
 *
 * Three ways to answer, picked per call:
 * - `a`: Lawexa voice (Stay's option 1, 22 November 2026). A fast front voice
 *   talks with the caller; Lawexa researches in the background and the page
 *   passes each answer into the call when the line is quiet.
 * - `c`: Lawexa in the middle. ElevenLabs hears and speaks; Lawexa's own model
 *   writes every answer, and says a short line at once when it has to research.
 * - `b`: ElevenLabs' own model answers, with Lawexa's case search as its tool.
 */
export type VoiceTestMode = 'a' | 'c' | 'b';

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
  /** `a` calls: passed to the call as its dynamic variables (session, caller's name, jurisdiction). */
  dynamic_variables?: Record<string, string>;
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
  /** `queued`: an `a` call's research waiting behind another. */
  kind: 'answer' | 'research' | 'queued';
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

/**
 * The call as a chat, and what it cost (Backend c21b513c, 22 November 2026),
 * on `POST .../end` and `GET .../turns`. A `c` call's chat exists from the
 * start; a `b` call's is made 15 to 30 seconds after it ends, so
 * `conversation_uuid` is null until then. Each answered question takes a
 * message; once they run out the rest are recorded unpaid.
 */
export interface VoiceCallSaved {
  conversation_uuid: string | null;
  charged_questions: number;
  unpaid_questions: number;
  out_of_messages: boolean;
}

export interface VoiceServerTurns extends VoiceCallSaved {
  session_uuid: string;
  mode: VoiceTestMode;
  turns: VoiceServerTurn[];
}

export interface VoiceCallEnded extends VoiceCallSaved {
  session_uuid: string;
  duration_seconds: number;
}
