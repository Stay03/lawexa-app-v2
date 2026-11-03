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
}

/** `POST /api/user-box/done`: Lawexa drives again, and a chat that was waiting continues. */
export interface UserBoxDoneResult {
  control: UserBoxControl;
  resumed: boolean;
  execution_id?: string;
  conversation_uuid?: string;
}

/** `users.{uuid}` → `.userbox.control`, when control moves. */
export interface UserBoxControlEvent {
  control: UserBoxControl;
  reason: UserBoxControlReason | null;
  message: string | null;
}
