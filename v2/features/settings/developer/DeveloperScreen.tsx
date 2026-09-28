'use client';

import { ArrowUpToLine, FlaskConical } from 'lucide-react';

import { switchBackToV1 } from '@/app/v2/switch-back-button';
import { setSearchPosition, useSearchPosition } from '@/v2/search-position';
import { SETTINGS_COLUMN, SettingsBlock } from '../SettingsList';
import { SettingsToggleRow } from '../SettingsToggleRow';

/**
 * DeveloperScreen — v2 `/settings/developer`: the two switches the owner kept
 * (28 September 2026, "leave v2 and searchbar position options remove the
 * rest"). v1's page also carried the line-by-line answer style and two
 * theme-bar experiments; those stay on v1's page, which v1 users still see.
 *
 * ── THE v2 SWITCH IS ON BY CONSTRUCTION ────────────────────────────────────
 * The proxy serves this page only to a browser that carries the v2 cookie, so
 * anyone reading it is inside v2 and the switch is on. It is not read from
 * `document.cookie`: that value does not exist on the server, and reading it
 * on the first client render would disagree with the server's HTML. Turning it
 * off is the header menu's "Switch to classic Lawexa", the same function, so
 * the two ways out cannot drift.
 *
 * ── THE SEARCH POSITION ────────────────────────────────────────────────────
 * Read through `useSearchPosition`, whose server snapshot is the default
 * ("bottom"), so the server and the first client render agree and the switch
 * settles to the stored value without a hydration error. Writing it updates
 * every v2 list at once, in this tab and in others.
 */
export function DeveloperScreen() {
  const searchPosition = useSearchPosition();

  return (
    <div className={SETTINGS_COLUMN}>
      {/* One title per screen at every width: the bar carries it below `md:`,
          the page draws it from `md:` up (see SettingsScreen). */}
      <h1 className="sr-only md:not-sr-only md:mb-5 md:text-2xl md:font-semibold md:tracking-tight md:text-foreground">
        Developer
      </h1>

      <SettingsBlock id="developer" label="Developer">
        <SettingsToggleRow
          icon={FlaskConical}
          label="New Lawexa (v2)"
          hint="Turn off to go back to classic Lawexa. The app reloads."
          checked
          onCheckedChange={(next) => {
            if (!next) switchBackToV1();
          }}
        />
        <SettingsToggleRow
          icon={ArrowUpToLine}
          label="Search box at the top"
          hint="Lists show their search box under the title instead of at the bottom of the screen."
          checked={searchPosition === 'top'}
          onCheckedChange={(next) => setSearchPosition(next ? 'top' : 'bottom')}
        />
      </SettingsBlock>
    </div>
  );
}
