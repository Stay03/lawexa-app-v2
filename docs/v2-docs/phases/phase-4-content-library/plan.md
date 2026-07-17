# Phase 4 — Content Library: plan

**Objective:** the shareable content domains rebuilt server-first — this is where social
previews and SEO get fixed (audit Part 3 §12).

> Expand to task level at kickoff.

## Scope

1. **Cases**: list (server-prefetched, infinite per data policy) + detail + report view; reader
   mode; view limits; bookmarks (optimistic per mutation policy). Server `page.tsx` +
   `generateMetadata` + `opengraph-image.tsx` per case.
2. **Statutes**: list with country tabs + detail on the v2 AKN renderer ONLY (statutes-old and
   the v1 tree renderer are not ported). Table overflow wrappers (audit mobile finding).
   Metadata + OG.
3. **Notes**: browse/read/create/edit/publish with the TipTap editor and case mentions
   (mention tooltips move onto the query cache — kill the module-level Map). No purchases.
   Metadata + OG for public notes.
4. **Folders & files**: folders (colors/icons/nesting, add-item flows now optimistic-or-patch
   per policy), files upload/manage.
5. **Bookmarks page** + trending/community read surfaces if cheap here (else phase 6).
6. **Sitemap entries** for cases/statutes/notes; breadcrumb title resolution (no more raw slugs).

## Exit criteria

Pasting a case/note/statute link on social shows a rich, correct preview; content browsing in
v2 feels faster than v1 (server-rendered first paint); back-navigation preserves list position
per data policy; `post-implementation.md` written.
