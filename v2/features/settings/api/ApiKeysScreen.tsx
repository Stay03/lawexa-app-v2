import { KeyRound } from 'lucide-react';

import { SETTINGS_COLUMN } from '../SettingsList';
import { SettingsState } from '../SettingsState';

/**
 * ApiKeysScreen — `/settings/api`, a door that says plainly it is not open yet.
 *
 * THE OWNER ASKED FOR THIS ROW (4 October 2026, Use Lawexa 25b5f81f: "do api
 * key but make it coming soon"), after `rows.ts` had kept it off the list as a
 * dead row. v1's page is the same promise (`app/(main)/settings/api/page.tsx`,
 * a `ComingSoonCard` and nothing else); no API-key endpoint exists yet. The
 * screen therefore makes no request and offers no control: it names the feature
 * and says it is coming, so nobody looks for a key that cannot be made.
 *
 * Server-rendered as it stands: there is nothing to load and no state to hold.
 */
export function ApiKeysScreen() {
  return (
    <div className={SETTINGS_COLUMN}>
      <h1 className="sr-only md:not-sr-only md:mb-5 md:text-2xl md:font-semibold md:tracking-tight md:text-foreground">
        API keys
      </h1>
      <SettingsState
        icon={KeyRound}
        title="API keys are coming soon"
        description="You will be able to create keys here to use Lawexa from your own tools and integrations."
      />
    </div>
  );
}
