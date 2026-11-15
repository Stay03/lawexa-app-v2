import { isAxiosError } from 'axios';

/**
 * space-limit — the refusal organisation plans give at a Space limit
 * (Backend's org-plans-part9, SpaceLimitReachedException): a 403 with
 * `errors.reason` "space_limit_reached" and a sentence that names the plan
 * and the limit ("Your Free plan allows 3 Spaces, and you are in 3. Leave a
 * Space or upgrade to join another."). It answers creating, joining,
 * accepting an invite or a link, making a link, inviting and approving a
 * request alike, so every screen reads it here and shows that sentence,
 * never its own words for "not allowed".
 */

export const SPACE_LIMIT_REASON = 'space_limit_reached';

/** Which limit: how many Spaces a person may be in, or how many people a Space may hold. */
export type SpaceLimitType = 'spaces_max' | 'space_invites_max';

export interface SpaceLimit {
  /** The server's sentence, naming the plan and the limit. */
  message: string;
  limitType: SpaceLimitType | null;
  limit: number | null;
  plan: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The Space limit in a refused response's body, or null when it is another refusal. */
export function spaceLimitOf(status: number | undefined, body: unknown): SpaceLimit | null {
  if (status !== 403 || !isRecord(body) || !isRecord(body.errors)) return null;
  const errors = body.errors;
  if (errors.reason !== SPACE_LIMIT_REASON || typeof body.message !== 'string' || body.message.trim() === '') return null;
  return {
    message: body.message.trim(),
    limitType: errors.limit_type === 'spaces_max' || errors.limit_type === 'space_invites_max' ? errors.limit_type : null,
    limit: typeof errors.limit === 'number' ? errors.limit : null,
    plan: typeof errors.plan === 'string' ? errors.plan : null,
  };
}

/** The Space limit in a failed request, or null. */
export function spaceLimitFromError(error: unknown): SpaceLimit | null {
  if (!isAxiosError(error) || !error.response) return null;
  return spaceLimitOf(error.response.status, error.response.data);
}
