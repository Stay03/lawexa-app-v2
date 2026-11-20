/**
 * Lawexa's machine (Userbox v1, thread f09347fd, Stay's go 3 November 2026):
 * a browser of the person's own that Lawexa drives with its box_* tools, for
 * staff (Researcher and above). The server's contract is
 * `UserBoxController` (Backend, userbox-laravel) and the userbox repo's
 * docs/api.md.
 */

/** Who drives the machine. */
export type UserBoxControl = 'lawexa' | 'user';

/** Why the person drives it: Lawexa handed it over, or the person acted on it. */
export type UserBoxControlReason = 'hand_over' | 'user_acted';

/** The machine's last known state; `missing` before it was ever made. */
export type UserBoxState = 'awake' | 'asleep' | 'missing';

export interface UserBoxView {
  /** `wss://userbox.lawexa.com/boxes/{uuid}/view?token=…`, good until `expires_at` (10 minutes). */
  url: string;
  expires_at: string;
}

/** `GET /api/user-box`, and the answer of wake, sleep and take-over. */
export interface UserBoxStatus {
  /** False while the machines are off (admin setting) or not set up: nothing is shown. */
  enabled: boolean;
  state: UserBoxState | string;
  control: UserBoxControl;
  control_reason: UserBoxControlReason | null;
  /** Lawexa's request when it handed the machine over ("Log in, then press Done"). */
  hand_over_message: string | null;
  /** Only on the read; wake, sleep and take-over leave it out. */
  view: UserBoxView | null;
  /**
   * While Lawexa waits for the person after a hand-over (Arthur's 3, thread
   * 38ad195b): one reminder at `remind_at` (10 minutes), and at `stops_at`
   * (30 minutes) Lawexa stops waiting. Null otherwise.
   */
  waiting?: UserBoxWaiting | null;
  /** The chat whose turn holds the machine (Arthur's 5: one chat at a time). Null when free. */
  held_by?: UserBoxHolder | null;
}

export interface UserBoxWaiting {
  since: string;
  remind_at: string;
  stops_at: string;
}

export interface UserBoxHolder {
  conversation_uuid: string;
  title: string;
}

/** `POST /api/user-box/done`: Lawexa drives again, and a chat that was waiting continues. */
export interface UserBoxDoneResult {
  control: UserBoxControl;
  resumed: boolean;
  execution_id?: string;
  conversation_uuid?: string;
}

/**
 * `POST /api/user-box/release`: the machine, freed (Arthur's a, thread
 * 38ad195b). Sent with the chat it was freed from, the server also continues
 * that chat's turn the way Done continues a waiting chat (`resumed`).
 */
export type UserBoxReleaseResult = UserBoxStatus & {
  resumed?: boolean;
  execution_id?: string;
  conversation_uuid?: string;
};

/** `users.{uuid}` → `.userbox.control`, when control moves. */
export interface UserBoxControlEvent {
  control: UserBoxControl;
  reason: UserBoxControlReason | null;
  message: string | null;
  /** As on the read (thread 38ad195b); absent from a server before it. */
  waiting?: UserBoxWaiting | null;
  held_by?: UserBoxHolder | null;
}
