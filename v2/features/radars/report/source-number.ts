/**
 * The number a reader sees for a report's source: its stored `position`,
 * counted from one. The API stores positions from 0 (`RadarScanService`:
 * `array_values($sources) as $position`), so every report showed its first
 * source as "0" while the prose cites it as "[1]" (26 October 2026).
 */
export function sourceNumber(position: number): number {
  return position + 1;
}
