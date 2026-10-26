'use client';

import { RadarScreen } from '@/v2/features/radars/detail/RadarScreen';
import { RadarScopeProvider } from '@/v2/features/radars/scope-context';

/**
 * SpaceRadarScreen — `/spaces/{space}/radars/{radar}` (Radar in Spaces, first
 * part, 26 October 2026): a space's Radar, read by every member. It is the
 * personal Radar screen with the space's scope (`scope-context`), so its reads
 * and actions call `/spaces/{space}/radars/...` and its links stay in the space.
 *
 * What changes for a space Radar is decided by the server's flags, never by a
 * role read here: Scan now, Pause, Resume, Settings and Archive show only with
 * `can_manage` (its creator and the space's Owners and Admins); a report row's
 * triage menu only with `can_triage`. Its page names the space and its maker,
 * and `schedule_state: 'no_balance'` says the space's owner is out of messages.
 */
export function SpaceRadarScreen({ spaceUuid, radarUuid }: { spaceUuid: string; radarUuid: string }) {
  return (
    <RadarScopeProvider scope={{ kind: 'space', spaceUuid }}>
      <RadarScreen radarUuid={radarUuid} />
    </RadarScopeProvider>
  );
}
