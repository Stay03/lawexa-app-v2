/**
 * Recording a meeting (thread ac47b1df; Stay's option C, 20 November 2026;
 * Backend's server half, recorder-voice-server-half.md section 3). Staff only
 * at first (`user.can_record`).
 */

/** Where a recording belongs, and where its card and summary are posted. */
export type RecordingTargetInput =
  | { conversation_uuid: string }
  | { space_uuid: string; channel_uuid: string; thread_uuid?: string };

/** The live transcriber's settings, with a single-use token for it (15 minutes, one use). */
export interface RecordingLiveConfig {
  token: string;
  expires_at: string;
  model_id: string;
  /** Up to 50 names and terms the live transcriber should expect (made by the server at Record). */
  keyterms: string[];
  language_code: string | null;
  /**
   * Whether the live text names speakers (admin setting recording_live_diarize,
   * on by default: Stay chose labels, 21 November 2026). True: the socket asks
   * for labels and each settled line shows its speaker; the moving line never
   * does (labels arrive only after a segment settles). Absent: off.
   */
  diarize?: boolean;
}

/** `POST /recordings`: the new recording, and how to start its live text. */
export interface RecordingStart {
  uuid: string;
  live: RecordingLiveConfig;
}

/** After Stop: what the server is doing with the recording. */
export type RecordingStage = 'recording' | 'uploading' | 'transcribing' | 'summarising' | 'done' | 'failed';

export interface RecordingFileRef {
  id: number;
  name: string;
  mime_type?: string;
  size: number;
}

export interface RecordingTarget {
  type: 'conversation' | 'space';
  uuid: string;
  name: string;
  /** The app address of the chat or the Space thread. */
  url: string;
}

/** A recording, as `GET /recordings/{uuid}`, the list rows and Stop's answer give it. */
export interface Recording {
  uuid: string;
  title: string;
  stage: RecordingStage;
  /** A plain sentence when a step failed. */
  error: string | null;
  duration_seconds: number | null;
  speaker_count: number | null;
  created_at: string;
  target: RecordingTarget | null;
  audio_file: RecordingFileRef | null;
  transcript_file: RecordingFileRef | null;
  /** A short-lived address the audio player can load (an <audio> cannot send the sign-in token). */
  audio_url?: string | null;
}

/** `users.{uuid}` → `.recording.updated`: a recording moved a stage after Stop. */
export interface RecordingUpdatedEvent {
  uuid: string;
  stage: RecordingStage;
  error: string | null;
}

/** On the message the server posts for a finished recording (`metadata.type` "recording"). */
export interface RecordingMessageMeta {
  recording_uuid: string;
  duration_seconds: number | null;
  speaker_count: number | null;
  audio_file: RecordingFileRef | null;
  transcript_file: RecordingFileRef | null;
}
