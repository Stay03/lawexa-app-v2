import type { RadarScanDetail, SharedRadarScanDetail } from '@/types/radar';

/**
 * viewer.ts — the ONE seam that resolves who is reading a scan report
 * (study B0: "ownership by duck-typing — keep but centralize").
 *
 * ── THE THREE VIEWER CLASSES, AND WHERE EACH READS FROM ─────────────────────
 *  OWNER            a signed-in account that owns the radar. The authed
 *                   endpoint (`GET /radars/{r}/scans/{s}`) answers with the
 *                   FULL shape — triage fields, `is_private`, error detail.
 *  SIGNED-IN OTHER  a signed-in account that does NOT own it. The SAME authed
 *                   endpoint answers with the TRIMMED reader shape when the
 *                   scan is published (and 403/404 when it is not) — so the
 *                   response type is honestly a union, resolved here.
 *  PUBLIC / GUEST   no account token (signed out) or a guest session. They
 *                   read the public endpoint (`GET /public/radars/…`), which
 *                   serves the trimmed shape for published scans and 404 for
 *                   everything else.
 *
 * The duck-type is v1's proven rule: `is_private` is an owner-only field, so
 * its presence IS ownership. Every affordance decision (triage toolbar, share
 * dialog, radar back-link, view counts) flows from this one function — no
 * scattered `'is_private' in x` checks, no non-null assertions.
 */

export type ScanView = RadarScanDetail | SharedRadarScanDetail;

/** Owner-only fields mark the full shape. */
export function isOwnerScan(scan: ScanView): scan is RadarScanDetail {
  return 'is_private' in scan;
}

export interface ResolvedScanViewer {
  /** What this viewer is allowed to see, whichever endpoint served it. */
  view: ScanView | undefined;
  /** True only for the full owner payload. */
  isOwner: boolean;
  /** The radar's display name, wherever this viewer class can read it from. */
  radarName: string | null;
}

/**
 * Resolve the viewer from the two possible reads. `authedData` is typed as
 * the union its runtime honestly is — the API client's declared
 * `RadarScanDetail` is the OWNER's case of it (the cast happens once, here,
 * at the seam).
 */
export function resolveScanViewer(args: {
  /** Whether this session reads the authed endpoint (signed-in non-guest). */
  isAccount: boolean;
  authedData: RadarScanDetail | undefined;
  publicData: SharedRadarScanDetail | undefined;
}): ResolvedScanViewer {
  const { isAccount, authedData, publicData } = args;
  const view: ScanView | undefined = isAccount
    ? (authedData as ScanView | undefined)
    : publicData;
  const isOwner = isAccount && view !== undefined && isOwnerScan(view);
  const radarName =
    view && 'radar' in view ? (view.radar?.name ?? null) : null;
  return { view, isOwner, radarName };
}
