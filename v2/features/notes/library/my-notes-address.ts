/**
 * Where v1's `/notes/mine` lands in v2: the library's My notes tab, with every
 * other parameter the old link carried. The redirect used to drop them, so
 * `/notes/mine?search=lagos` opened an unfiltered list (backend's check, 23
 * October 2026). `tab` is always `mine`, whatever the old link said.
 */
export function myNotesAddress(search: Readonly<Record<string, string | string[] | undefined>>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (key === 'tab' || value === undefined) continue;
    for (const one of Array.isArray(value) ? value : [value]) query.append(key, one);
  }
  query.set('tab', 'mine');
  return `/notes?${query.toString()}`;
}
