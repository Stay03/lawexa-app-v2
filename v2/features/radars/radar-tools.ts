/**
 * radar-tools — Lawexa's tools in a chat that make or change a Radar (the
 * server's RadarSeeder; Space-aware from a space's chat, Backend's radar-tools
 * step, Stay 26 October 2026: "the Lawexa in spaces should have space radar
 * tools to do space radar tasks"). When one of them finishes in a chat, the
 * Radar lists the reader may go back to (the Radar page's, and the space's
 * Radars pill) are out of date, so the chat re-asks them.
 *
 * Reading tools (list_radars, list_radar_scans, view_radar_scan) change
 * nothing and are left out. Pure, so the test can run it.
 */

const RADAR_CHANGING_TOOLS: ReadonlySet<string> = new Set([
  'create_radar',
  'update_radar',
  'pause_radar',
  'resume_radar',
  'delete_radar',
  'scan_radar_now',
]);

export function radarToolChangesRadars(toolName: string): boolean {
  return RADAR_CHANGING_TOOLS.has(toolName);
}
