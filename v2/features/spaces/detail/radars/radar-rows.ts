import type { SpaceRadarListItem, SpaceRadarReport } from '@/types/collab';
import type { RadarScheduleState } from '@/types/radar';
import { formatRelativeTime } from '@/v2/shell/designs/modules/meta';
import { scheduleSummary } from '@/v2/features/radars/model';

/**
 * radar-rows — what a Radar and a Radar report say in a space (Radar in
 * Spaces, first part, 26 October 2026). Pure: the feed's report row, the
 * Radars pill's row, and the links both open. The rows draw it in the feed's
 * one row (`feed-rows`), so a report reads like every other thing in the
 * space: an icon, a name and a time, one quiet fact under it, and no menu
 * (Stay, 18 October 2026).
 */

/** A space's Radar, inside the space. */
export function spaceRadarHref(spaceUuid: string, radarUuid: string): string {
  return `/spaces/${encodeURIComponent(spaceUuid)}/radars/${encodeURIComponent(radarUuid)}`;
}

/** One report of a space's Radar, inside the space. Built from the uuids
 *  rather than the row's `url`, so a link never leaves the app's own routes. */
export function spaceRadarReportHref(spaceUuid: string, radarUuid: string, scanUuid: string): string {
  return `${spaceRadarHref(spaceUuid, radarUuid)}/scans/${encodeURIComponent(scanUuid)}`;
}

/** A space's New Radar screen. */
export function newSpaceRadarHref(spaceUuid: string): string {
  return `/spaces/${encodeURIComponent(spaceUuid)}/radars/new`;
}

/** What a report's title reads when the scan has none yet. */
export const UNTITLED_REPORT = 'Radar report';

export interface ReportRowModel {
  title: string;
  /** The Radar's name, then the report's first line when it has one. */
  meta: string;
  /** Unread by THIS reader (read state is per member). */
  unread: boolean;
  href: string;
  time: string;
}

export function reportRowModel(report: SpaceRadarReport, spaceUuid: string, now: number): ReportRowModel {
  const excerpt = report.excerpt?.trim();
  return {
    title: report.title?.trim() || UNTITLED_REPORT,
    meta: excerpt ? `${report.radar.name} · ${excerpt}` : report.radar.name,
    unread: report.read_at === null,
    href: spaceRadarReportHref(spaceUuid, report.radar.uuid, report.uuid),
    time: now > 0 ? formatRelativeTime(report.completed_at, now) : '',
  };
}

/** The word after a Radar's name when it is not simply running. One or two
 *  words: it shares the name's line. The Radar's own screen says why a
 *  stopped one stopped. `null` while it runs as set. */
export function radarStateWord(
  radar: Pick<SpaceRadarListItem, 'status'> & { schedule_state?: RadarScheduleState },
): string | null {
  if (radar.status === 'archived') return 'Archived';
  if (radar.status === 'paused' || radar.schedule_state === 'paused') return 'Paused';
  if (radar.schedule_state === 'no_balance') return 'Stopped';
  if (radar.schedule_state === 'failed') return 'Last scan failed';
  return null;
}

export interface RadarRowModel {
  title: string;
  state: string | null;
  /** The schedule, then who made it. */
  meta: string;
  /** This reader's unread reports. */
  unread: number;
  href: string;
  /** When its newest report came, else when it last scanned. */
  time: string;
}

export function radarRowModel(radar: SpaceRadarListItem, spaceUuid: string, now: number): RadarRowModel {
  const creator = radar.creator?.name?.trim();
  const schedule = scheduleSummary(radar.schedule_cron);
  return {
    title: radar.name,
    state: radarStateWord(radar),
    meta: creator ? `${schedule} · ${creator}` : schedule,
    unread: Math.max(0, radar.unread_reports_count),
    href: spaceRadarHref(spaceUuid, radar.uuid),
    time: now > 0 ? formatRelativeTime(radar.latest_report?.completed_at ?? radar.last_scan_at, now) : '',
  };
}
