/**
 * Adds the sharer's ambassador code to a link they are about to share.
 *
 * ── WHY IT EXISTS ─────────────────────────────────────────────────────────
 * Arthur asked on 2 September 2026 for a shared case, statute or conversation
 * to credit the ambassador who shared it. Today none of them do: every share
 * copies the plain address, and the only link in the whole app that carries a
 * code is the ambassador's own referral link.
 *
 * The techlead's record is that this was agreed with him on 19 August and never
 * built, so it is an unbuilt promise rather than a defect.
 *
 * ── THE CREDITING BEHIND IT ALREADY WORKS ─────────────────────────────────
 * Nothing new is needed to make the credit land. A visitor arriving on a link
 * with a code has it captured on first touch and sent on whichever auth call
 * comes first, which for nearly everyone is the guest token. See
 * `lib/utils/attribution.ts`. So the whole job is putting the code INTO the
 * link, and this file is that.
 *
 * ── ONE REAL LIMIT, AND IT IS NOT OURS TO FIX HERE ────────────────────────
 * The captured code lives in session storage, so it survives refreshes and
 * navigation but not the tab being closed. Somebody who opens a shared link,
 * closes it, and signs up tomorrow credits nobody. Worth knowing before anyone
 * promises ambassadors that every signup from their link counts.
 */

/** Both spellings the app already accepts on the way in. `ref` is the short one
 *  the ambassador screen uses, so shared links match what people already see. */
const PARAM = 'ref';

/**
 * Returns `url` with the code attached, or unchanged when there is no code.
 *
 * `null` in, unchanged out, deliberately: most people sharing a case are not
 * ambassadors and have no code at all, so the ordinary path through here must
 * be a no-op rather than something callers have to guard.
 *
 * An address that already carries a code is left exactly as it is. A shared
 * link that already credits somebody must not be quietly re-credited to whoever
 * shared it next.
 */
export function withReferral(url: string, code: string | null): string {
  if (!code) return url;

  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has(PARAM) || parsed.searchParams.has('referral_code')) {
      return url;
    }
    parsed.searchParams.set(PARAM, code);
    return parsed.toString();
  } catch {
    /* Not a URL we can parse. Hand back exactly what we were given rather than
       guessing at string surgery — a share that copies the wrong address is
       worse than one that copies a link with no code on it. */
    return url;
  }
}
