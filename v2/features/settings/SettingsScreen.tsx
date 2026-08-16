'use client';

import { useMemo } from 'react';

import {
  useV2Session,
  type V2SessionSnapshot,
} from '@/v2/runtime/session-context';
import { AccountCard } from './AccountCard';
import {
  SETTINGS_COLUMN,
  SettingsBlock,
  SettingsLinkRow,
} from './SettingsList';
import { visibleSettingsGroups } from './rows';

/**
 * SettingsScreen — the v2 settings home: the account you are in, and every door
 * out of it.
 *
 * ── THE BASE ONLY (owner, 16 August 2026) ──────────────────────────────────
 * "Don't do the individual options yet just the base, we do each page/options
 * step by step." So this screen is a list of destinations and nothing else. It
 * changes no setting, holds no form and owns no state; the one thing it fetches
 * is the plan on the account card, which the owner asked for by name.
 *
 * Eight of its nine rows still open the classic app through the proxy. That is
 * deliberate and it is how the whole v2 tree has grown: these are real settings
 * people need today, and a row that goes nowhere is worse than a row that goes
 * to the page that works. Which rows those are, and the two edits that move one
 * into v2, are written in `rows.ts`.
 *
 * ── WHAT THIS SCREEN IS NOT ────────────────────────────────────────────────
 * It is not a v1 settings layout with a second sidebar (see `SettingsList` for
 * why that did not come across), and it is not a top-level screen: it is
 * reached from the header's overflow menu, so it is a screen you PUSHED into.
 * The back arrow and the bar's title come from `v2/shell/pushed-route.ts`, and
 * the heading below is drawn only from `md:` up, where the bar's title is
 * hidden — one title on the pixels at every width.
 */
export function SettingsScreen() {
  const session = useV2Session();
  const { role, signedIn } = session;

  // Pure and synchronous, off the snapshot the layout already resolved — the
  // right rows are on the first paint and nothing appears a moment later.
  const groups = useMemo(
    () => visibleSettingsGroups(role, signedIn),
    [role, signedIn],
  );

  return (
    <div className={SETTINGS_COLUMN}>
      {/* ONE TITLE PER SCREEN, AT EVERY WIDTH. The shell's bar says "Settings"
          below `md:`, so the heading is stated for assistive tech and drawn
          only from `md:` up, where the bar's title is `display:none`. */}
      <h1 className="sr-only md:not-sr-only md:mb-5 md:text-2xl md:font-semibold md:tracking-tight md:text-foreground">
        Settings
      </h1>

      <AccountCard />

      {/* NO VISIBLE GROUP HEADINGS. The gap between blocks is the grouping —
          that is what the reference screens do and what the owner described.
          Each block still names itself for assistive technology, so the
          document has four sections rather than one run of nine links. */}
      <div className="mt-4 flex flex-col gap-4">
        {groups.map((group) => (
          <SettingsBlock key={group.id} id={group.id} label={group.label}>
            {group.rows.map((row) => (
              <SettingsLinkRow
                key={row.id}
                href={row.href}
                icon={row.icon}
                label={row.label}
                value={rowValue(row.id, session) ?? undefined}
              />
            ))}
          </SettingsBlock>
        ))}
      </div>
    </div>
  );
}

/**
 * The quiet second line under a row's label, or `null` for a row that has none.
 *
 * ── THE RULE, AND WHY THERE IS ONLY ONE LINE HERE TODAY ────────────────────
 * A value is drawn only where this screen can read it CHEAPLY and HONESTLY. It
 * may never be guessed, and the settings index may never fetch an option page's
 * own data just to fill a line — a list of doors that costs nine requests to
 * open is not a list of doors.
 *
 * That leaves exactly one, and it is free: the viewer's `@handle`, which came
 * with the session. It is worth stating because without one nobody can tag this
 * person at all, so the row says whether Profile still has something behind it
 * that needs doing.
 *
 * The rows that look like they should have a value and must not:
 *  - Appearance. `/settings/appearance` does not hold the theme (it holds
 *    Reader Mode and the agent-activity switch), so "Dark" under that label
 *    would name a setting the page cannot change. See `rows.ts`.
 *  - Organization, Usage, Billing, Message packs. Every one of those values is
 *    a request, and each belongs to the screen that is about to make it anyway.
 *
 * As each option is rebuilt in v2 its value lands here, next to this comment.
 */
function rowValue(rowId: string, session: V2SessionSnapshot): string | null {
  if (rowId === 'profile') {
    return session.username ? `@${session.username}` : 'Set a handle';
  }
  return null;
}
