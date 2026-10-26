'use client';

import { ScanReportScreen } from '@/v2/features/radars/report/ScanReportScreen';
import { RadarScopeProvider } from '@/v2/features/radars/scope-context';

/**
 * SpaceRadarReportScreen — `/spaces/{space}/radars/{radar}/scans/{scan}`
 * (Radar in Spaces, first part, 26 October 2026): one report of a space's
 * Radar, read by every member. The personal report page with the space's
 * scope (`scope-context`): its links stay in the space, and its toolbar
 * follows the space Radar's `can_triage` and its share `can_manage`.
 *
 * The report itself is read through `GET /radars/{radar}/scans/{scan}`, which
 * answers any member of the Radar's space (Backend, 26 October 2026); see
 * `radarCalls` in `v2/features/radars/scope.ts`. No Word or PDF download yet:
 * the export comes with Backend's next step.
 */
export function SpaceRadarReportScreen({
  spaceUuid,
  radarUuid,
  scanUuid,
}: {
  spaceUuid: string;
  radarUuid: string;
  scanUuid: string;
}) {
  return (
    <RadarScopeProvider scope={{ kind: 'space', spaceUuid }}>
      <ScanReportScreen radarUuid={radarUuid} scanUuid={scanUuid} />
    </RadarScopeProvider>
  );
}
