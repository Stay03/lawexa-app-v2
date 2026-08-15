import { SegmentFallback } from '@/v2/shell/segment-fallback';

/**
 * The `radars` SEGMENT boundary.
 *
 * ── WHY IT IS EMPTY, AND WHY IT USED TO BE THE LIST ────────────────────────
 * A segment's `loading.tsx` wraps its CHILD SLOT, not its own page. Until now
 * `/radars` had no route group, so ONE file was doing two jobs: it was the
 * list's own fallback AND the boundary every child was navigated into. Being
 * the list's fallback, it rendered `RadarsFallback` — so opening a radar, a
 * scan or the create form painted the RADAR LIST while a document or a form was
 * on its way.
 *
 * That is the same fault the owner reported on cases in July ("I first see the
 * case list skeleton, then the case skeleton"), and the same fix: the list page
 * moves into a `(list)` route group with its own boundary, and this file becomes
 * what the children need. Radars was simply the one section the July pass never
 * reached — `cases`, `statutes`, `folders` and `quiz` all received it.
 *
 * ITS CHILDREN DO NOT SHARE A SHAPE. `[radarUuid]` is a document, its
 * `scans/[scanUuid]` is another document, and `new/` is a form. Rule 2 in
 * `app/v2/loading.tsx` is literal about this case: a segment boundary whose
 * children differ must be NEUTRAL, never one sibling's shape — and neutral
 * means empty, because the persistent shell already frames the wait and any
 * silhouette would be a lie about where the reader is going.
 *
 * Nothing is lost by being empty here: all three children carry their own
 * correctly-shaped boundary, and they take over the moment their shell arrives.
 */
export default function RadarsSegmentLoading() {
  return <SegmentFallback label="Loading radar section" />;
}
