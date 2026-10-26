import { radarsApi, spaceRadarsApi } from '@/lib/api/radars';
import type { ApiResponse } from '@/types/api';
import type {
  RadarDetailResponse,
  RadarScanDetailResponse,
  RadarScanListParams,
  RadarScanListResponse,
  RadarScanResponse,
  TriageScanPayload,
  UpdateSpaceRadarPayload,
} from '@/types/radar';

/**
 * WHERE A RADAR LIVES (Radar in Spaces, 26 October 2026). A personal Radar
 * is reached at `/radars/...`; a Space Radar at `/spaces/{space}/radars/...`
 * (Backend's contract). Everything else is the same: the same Radar and scan
 * shapes, the same screens.
 *
 * The caches stay keyed by the Radar's uuid alone (`radarsQueries`): a uuid
 * names one Radar wherever it lives, and the old `GET /radars/{radar}` and
 * `GET /radars/{radar}/scans/{scan}` answer a Space member with the same
 * shape, so one Radar never holds two different answers under one key.
 */
export type RadarScope = { kind: 'personal' } | { kind: 'space'; spaceUuid: string };

export const PERSONAL_RADAR_SCOPE: RadarScope = { kind: 'personal' };

/** The calls one Radar screen makes, bound to where the Radar lives. */
export interface RadarCalls {
  get: (radarUuid: string) => Promise<RadarDetailResponse>;
  update: (radarUuid: string, payload: UpdateSpaceRadarPayload) => Promise<RadarDetailResponse>;
  pause: (radarUuid: string) => Promise<RadarDetailResponse>;
  resume: (radarUuid: string) => Promise<RadarDetailResponse>;
  scanNow: (radarUuid: string) => Promise<RadarScanResponse>;
  archive: (radarUuid: string) => Promise<ApiResponse<null>>;
  getScans: (radarUuid: string, params?: RadarScanListParams) => Promise<RadarScanListResponse>;
  getScan: (radarUuid: string, scanUuid: string) => Promise<RadarScanDetailResponse>;
  triageScan: (radarUuid: string, scanUuid: string, payload: TriageScanPayload) => Promise<RadarScanResponse>;
  publishScan: (radarUuid: string, scanUuid: string) => Promise<RadarScanResponse>;
  unpublishScan: (radarUuid: string, scanUuid: string) => Promise<RadarScanResponse>;
}

const PERSONAL_CALLS: RadarCalls = {
  get: radarsApi.getByUuid,
  update: radarsApi.update,
  pause: radarsApi.pause,
  resume: radarsApi.resume,
  scanNow: radarsApi.scanNow,
  archive: radarsApi.archive,
  getScans: radarsApi.getScans,
  getScan: radarsApi.getScan,
  triageScan: radarsApi.triageScan,
  publishScan: radarsApi.publishScan,
  unpublishScan: radarsApi.unpublishScan,
};

export function radarCalls(scope: RadarScope): RadarCalls {
  if (scope.kind === 'personal') return PERSONAL_CALLS;
  const { spaceUuid } = scope;
  return {
    get: (radarUuid) => spaceRadarsApi.get(spaceUuid, radarUuid),
    update: (radarUuid, payload) => spaceRadarsApi.update(spaceUuid, radarUuid, payload),
    pause: (radarUuid) => spaceRadarsApi.pause(spaceUuid, radarUuid),
    resume: (radarUuid) => spaceRadarsApi.resume(spaceUuid, radarUuid),
    scanNow: (radarUuid) => spaceRadarsApi.scanNow(spaceUuid, radarUuid),
    archive: (radarUuid) => spaceRadarsApi.archive(spaceUuid, radarUuid),
    getScans: (radarUuid, params) => spaceRadarsApi.getScans(spaceUuid, radarUuid, params),
    // ONE REPORT GOES TO /radars (Backend, 26 October 2026): a member reads a
    // space Radar's report, its triage and its share through the personal
    // routes, which check the space's rules; there is no space-scoped scan
    // route yet. If the per-member read step (B3) adds one, switch these four.
    getScan: radarsApi.getScan,
    triageScan: radarsApi.triageScan,
    publishScan: radarsApi.publishScan,
    unpublishScan: radarsApi.unpublishScan,
  };
}

/** The addresses a Radar screen links to, for where the Radar lives. */
export interface RadarHrefs {
  /** Where "up" is, and where an archived Radar leaves to. */
  list: string;
  radar: (radarUuid: string) => string;
  report: (radarUuid: string, scanUuid: string) => string;
}

export function radarHrefs(scope: RadarScope): RadarHrefs {
  if (scope.kind === 'personal') {
    return {
      list: '/radars',
      radar: (radarUuid) => `/radars/${radarUuid}`,
      report: (radarUuid, scanUuid) => `/radars/${radarUuid}/scans/${scanUuid}`,
    };
  }
  const space = `/spaces/${encodeURIComponent(scope.spaceUuid)}`;
  return {
    list: `${space}?tab=radars`,
    radar: (radarUuid) => `${space}/radars/${encodeURIComponent(radarUuid)}`,
    report: (radarUuid, scanUuid) =>
      `${space}/radars/${encodeURIComponent(radarUuid)}/scans/${encodeURIComponent(scanUuid)}`,
  };
}
