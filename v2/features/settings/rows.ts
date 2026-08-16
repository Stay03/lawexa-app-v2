import {
  Bell,
  Building2,
  CreditCard,
  FlaskConical,
  Gauge,
  MessageSquarePlus,
  Paintbrush,
  Ticket,
  User,
  type LucideIcon,
} from 'lucide-react';

import type { UserRole } from '@/types/auth';
import { canAccessCollab } from '@/lib/utils/collab-audience';
import { canAccessV2Preview } from '@/lib/utils/v2-access';

/**
 * settings/rows — every door on the settings screen, in one table.
 *
 * ── WHERE EACH ROW ACTUALLY GOES TODAY (READ THIS BEFORE BUILDING ONE) ─────
 * This is a screen built option by option. TWO rows already land in v2; the
 * rest cross into the classic app through the proxy, exactly as
 * `v2/shell/nav.config.ts` describes for an unmigrated nav row: v2 shell, v1
 * content, until the route joins `v2/routes.manifest.ts`.
 *
 *   Profile         /settings/profile        → V2 (rebuilt, 16 August 2026)
 *   Organization    /organization            → V2 (rebuilt, phase-5 W5)
 *   Usage           /settings/usage          → v1
 *   Billing         /settings/billing        → v1
 *   Message packs   /settings/message-packs  → v1
 *   Referrals       /settings/referrals      → v1
 *   Appearance      /settings/appearance     → v1
 *   Notifications   /settings/notifications  → v1
 *   Developer       /settings/developer      → v1
 *
 * BUILDING ONE MOVES THREE FILES, and this table is not usually one of them.
 * The row, its icon, its group and its audience are already here:
 *
 *  1. `v2/routes.manifest.ts`: add the EXACT path, so the proxy rewrites it
 *     into the v2 tree instead of passing it to v1.
 *  2. `v2/shell/pushed-route.ts`: add the address under `case 'settings'`, so
 *     the screen gets its back arrow and its title in the bar.
 *  3. this row's `href`, ONLY if the address moves. Organization's did (owner
 *     decision D7 lifted it out from under `/settings`); Profile's did not, so
 *     migrating it changed nothing here but the line above.
 *
 * A path under `/settings/` is therefore NOT a marker of "still v1" any more.
 * The list above is.
 *
 * ── THREE v1 PAGES ARE DELIBERATELY NOT LISTED ─────────────────────────────
 * `/settings/account`, `/settings/api` and `/settings/privacy` render a
 * `ComingSoonCard` and nothing else — measured 16 August 2026 in
 * `app/(main)/settings/{account,api,privacy}/page.tsx`, each of which is a
 * ten-line file with no controls in it. A row onto an empty page is the dead
 * row this screen exists to avoid; it is worse than no row, because the reader
 * pays a navigation to learn that nothing is there. They arrive here when they
 * are built, and the account/privacy work is where email, password and sessions
 * will live. (`/settings/general` is not listed either: it is a one-line
 * `redirect()` onto `/settings/appearance`.)
 *
 * ── SIGNING OUT IS NOT HERE YET ────────────────────────────────────────────
 * Both reference apps end their settings screen with it, and v2 has no sign-out
 * anywhere. It is not a link, though: v1's sign-out deactivates this device's
 * push token, wipes the confidential transcripts from IndexedDB, clears the auth
 * store and the query cache, and only then navigates
 * (`lib/hooks/useAuth.ts`) — plus v2's own httpOnly session cookie would have to
 * be cleared with it. That is an option's worth of work, and the instruction for
 * this pass was the base only.
 */

/**
 * A single settings door. Every field is a fact about the ROW, never about the
 * screen it opens: this table must stay something you can read to learn what
 * settings exist, without loading nine features to find out.
 */
export interface SettingsRow {
  /** Stable key. Also the row's test/anchor id if one is ever needed. */
  id: string;
  /** The words on the row. Sentence case, like every other v2 surface. */
  label: string;
  /** The leading glyph. Decorative — the label is the accessible name. */
  icon: LucideIcon;
  /** Canonical CLEAN path (never a `/v2`-prefixed one). See the module block. */
  href: string;
  /**
   * Whether this door needs a real registered account behind it.
   *
   * A guest is a view-only pre-registration identity: it has no profile to
   * edit, no plan, no invoices, no referral code and no organization. Showing
   * those rows to one is not a permission mistake, it is a lie about what they
   * have. What a guest keeps is the two device preferences, which work for
   * anybody holding the phone.
   *
   * NOT a security boundary — hiding a row hides an entry point, and each
   * destination gates itself. Same contract as `nav.config.ts`.
   */
  requiresAccount?: true;
  /**
   * Extra audience predicate over the SERVER-VERIFIED role, for a row whose
   * destination is narrower than "any registered account". Always a REUSED pure
   * helper, never a role list re-declared here — the rule `nav.config.ts` sets
   * and the reason both nav surfaces cannot drift.
   */
  canAccess?: (role: UserRole | null) => boolean;
}

/**
 * A filled block of rows.
 *
 * The grouping is the whole design: the reference screens carry no visible
 * group headings, and the gap between blocks does the work that a heading would
 * (see `SettingsScreen`). The `label` here is therefore stated for assistive
 * technology only — a screen reader moving by headings still meets four named
 * sections instead of one undifferentiated list of nine links.
 */
export interface SettingsGroup {
  id: string;
  /** Names the block for assistive technology. Never drawn. */
  label: string;
  rows: SettingsRow[];
}

/**
 * The table, in display order.
 *
 * ORDER IS BY WHAT THE READER CAME FOR, widest first: who you are, then what
 * you are paying and being paid, then how the app behaves, then the flags. That
 * is the order both reference apps use and the order v1's own sidebar already
 * had; keeping it means somebody who knows the classic settings does not have
 * to relearn where anything is.
 */
export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    id: 'you',
    label: 'Your account',
    rows: [
      {
        // THE FIRST OPTION REBUILT IN v2 (16 August 2026), and the address did
        // not move: `/settings/profile` is where it has always been, and
        // `v2/routes.manifest.ts` now claims it. It went first because it is
        // the option people actually open, and because a form is the thing the
        // settings row grammar had not yet been asked to carry.
        id: 'profile',
        label: 'Profile',
        icon: User,
        href: '/settings/profile',
        requiresAccount: true,
      },
      {
        id: 'organization',
        label: 'Organization',
        icon: Building2,
        // THE ONE ROW THAT STAYS INSIDE v2. Not `/settings/organization`: that
        // address is a redirect shell onto this one (owner decision D7 — an
        // organization is a thing you visit, not a preference you tune), and
        // pointing a fresh row at a redirect would spend a navigation to learn
        // the same thing this table already knows.
        href: '/organization',
        requiresAccount: true,
        // The same audience as the Spaces and Channels rows, from the same
        // shared helper, because it is the same feature's door.
        canAccess: canAccessCollab,
      },
    ],
  },
  {
    id: 'plan',
    label: 'Plan and payments',
    rows: [
      {
        id: 'usage',
        label: 'Usage',
        icon: Gauge,
        href: '/settings/usage',
        requiresAccount: true,
      },
      {
        id: 'billing',
        label: 'Billing',
        icon: CreditCard,
        href: '/settings/billing',
        requiresAccount: true,
      },
      {
        id: 'message-packs',
        label: 'Message packs',
        icon: MessageSquarePlus,
        href: '/settings/message-packs',
        requiresAccount: true,
      },
      {
        // MONEY THAT COMES IN, beside the money that goes out. v1 filed this
        // last, under the developer flags, because it was bolted on late.
        //
        // IT IS NOT GATED ON BEING AN AMBASSADOR, and v1's row is. v1 pays a
        // request for that (`GET` the ambassador application on every settings
        // page load) and then pops the row in when the answer lands, which is a
        // list that shifts under the cursor. The destination already answers
        // every state with a designed panel — "You're not an ambassador yet.
        // Applications are open" with a way to read about it, "Your application
        // is with us", and the real code and link once approved
        // (`components/ambassadors/ReferralScreen.tsx`) — so the honest row
        // costs nothing, shifts nothing, and tells people the programme exists.
        id: 'referrals',
        label: 'Referrals',
        icon: Ticket,
        href: '/settings/referrals',
        requiresAccount: true,
      },
    ],
  },
  {
    id: 'app',
    label: 'This app',
    rows: [
      {
        // NO QUIET VALUE ON THIS ROW, and it is the row that most looks like it
        // should have one. `/settings/appearance` does NOT hold the light/dark
        // theme — it holds Reader Mode and the agent-activity switch
        // (`app/(main)/settings/appearance/page.tsx`, measured). The theme lives
        // in the header's overflow menu. Printing "Dark" under this label would
        // name a setting the page it opens cannot change.
        id: 'appearance',
        label: 'Appearance',
        icon: Paintbrush,
        href: '/settings/appearance',
      },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        href: '/settings/notifications',
      },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    rows: [
      {
        id: 'developer',
        label: 'Developer',
        icon: FlaskConical,
        href: '/settings/developer',
        requiresAccount: true,
        // Every registered account since 3 August 2026; the helper excludes
        // only guests and bots. It is also the row that switches this preview
        // off, so it must never be hidden from somebody already inside v2.
        canAccess: canAccessV2Preview,
      },
    ],
  },
];

/**
 * The groups THIS viewer may see, with empty groups dropped.
 *
 * Pure and synchronous — it reads the session snapshot the v2 layout already
 * resolved, so the correct list is on the first paint and no row ever appears a
 * moment after the screen does.
 */
export function visibleSettingsGroups(
  role: UserRole | null,
  signedIn: boolean,
): SettingsGroup[] {
  const hasAccount = signedIn && role !== 'guest';
  const groups: SettingsGroup[] = [];
  for (const group of SETTINGS_GROUPS) {
    const rows = group.rows.filter((row) => {
      if (row.requiresAccount && !hasAccount) return false;
      return row.canAccess?.(role) ?? true;
    });
    if (rows.length > 0) groups.push({ ...group, rows });
  }
  return groups;
}
