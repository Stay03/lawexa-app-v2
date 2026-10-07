'use client';

import { ArrowUpToLine, Database, FlaskConical, HardDriveDownload, Route, Server, Zap, type LucideIcon } from 'lucide-react';

import { switchBackToV1 } from '@/app/v2/switch-back-button';
import { setSearchPosition, useSearchPosition } from '@/v2/search-position';
import { useV2Session } from '@/v2/runtime/session-context';
import { canUsePerfSwitch, setLayerOff, type PerfLayer } from '@/v2/runtime/perf-switch';
import { removeServiceWorker } from '@/v2/runtime/sw/register';
import { usePerfLayersOff } from '@/v2/runtime/use-perf-off';
import { SETTINGS_BLOCK, SETTINGS_COLUMN, SettingsBlock } from '../SettingsList';
import { SettingsToggleRow } from '../SettingsToggleRow';
import { PERF_LAYER_COPY, PERF_LAYERS_HEADING } from './perf-layers';

const PERF_LAYER_ICONS: Record<PerfLayer, LucideIcon> = {
  ssr: Server,
  idb: Database,
  route: Route,
  read: Zap,
  sw: HardDriveDownload,
};

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
  const { role } = useV2Session();
  const layersOff = usePerfLayersOff();

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

      {/* Admins only (owner, 7 October 2026): each performance layer on or off
          for this browser, to test with and without it (`perf-switch.ts`). The
          words are the owner's (`perf-layers.ts`); each switch shows only the
          line for its current state (owner, 7 October). Every change reloads the
          page, so nothing kept in memory under the old setting is shown. The
          heading is drawn on screen, unlike the shared block's hidden label. */}
      {canUsePerfSwitch(role) ? (
        <section aria-labelledby="perf-layers-heading" className="mt-8">
          <h2
            id="perf-layers-heading"
            className="mb-2 px-1 text-[13px] font-medium text-muted-foreground"
          >
            {PERF_LAYERS_HEADING}
          </h2>
          <ul className={SETTINGS_BLOCK}>
            {PERF_LAYER_COPY.map((copy) => (
              <SettingsToggleRow
                key={copy.layer}
                icon={PERF_LAYER_ICONS[copy.layer]}
                label={copy.label}
                hint={layersOff.has(copy.layer) ? copy.off : copy.on}
                checked={!layersOff.has(copy.layer)}
                onCheckedChange={(next) => {
                  setLayerOff(copy.layer, !next);
                  // Turning the worker off removes it first, so the reloaded
                  // page is not served by it.
                  const removed = copy.layer === 'sw' && !next ? removeServiceWorker() : Promise.resolve();
                  void removed.then(() => window.location.reload());
                }}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
