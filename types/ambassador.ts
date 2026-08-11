import type { PaginationMeta, PaginationLinks } from './case';

export type AmbassadorStatus = 'pending' | 'approved' | 'rejected';

export interface AmbassadorUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
}

export interface AmbassadorApplication {
  id: number;
  uuid: string;
  user: AmbassadorUser | null;
  name: string;
  email: string;
  phone: string;
  country: string | null;
  university: string | null;
  law_school: string | null;
  faculty: string | null;
  level: string | null;
  motivation: string;
  growth_plan: string;
  leadership_experience: string | null;
  social_handle: string | null;
  heard_from: string | null;
  status: AmbassadorStatus;
  status_label: string;
  reviewed_by: AmbassadorUser | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AmbassadorListResponse {
  success: boolean;
  message: string;
  data: AmbassadorApplication[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

export interface AmbassadorListParams {
  status?: AmbassadorStatus;
  sort?: 'created_at' | 'status' | 'updated_at' | 'reviewed_at';
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

/* ── Referral codes (2026-08-11) ─────────────────────────────────────────────
   Only the CODE half is typed here. The performance and admin-financials
   payloads are deliberately absent: @backendclaude is changing both tonight
   (`revenue` was summing naira and dollars into one meaningless number, and
   `referred_count` counted almost everybody twice — once as a guest, again at
   registration). Typing a shape that is mid-change is how a screen ships
   against a field nobody can explain. They land when he says they are settled.
   ───────────────────────────────────────────────────────────────────────── */

/**
 * One code an ambassador has held.
 *
 * A RETIRED CODE STILL WORKS, and that is the whole point of keeping the list.
 * Ambassadors print their code on a face card and hand it out; changing the
 * code must not break a card already in somebody's pocket. The screen shows the
 * retired ones so they can see that has not happened.
 */
export interface AmbassadorCode {
  code: string;
  is_current: boolean;
  retired_at: string | null;
  created_at?: string;
}

/** `current` is `null` before they have ever claimed one — that is the state
 *  that renders the claim form, NOT an error. */
export interface AmbassadorCodeState {
  current: AmbassadorCode | null;
  history: AmbassadorCode[];
}

export interface ApproveAmbassadorData {
  review_notes?: string;
}

export interface RejectAmbassadorData {
  review_notes: string;
}
