# phase-3-home-chat — post-implementation

> Written at phase close. The next phase does not start until this is filled in.

**Closed July 25, 2026.** Gate passed: the owner ran `w6-device-verification.md` on real
hardware and reported it clean, and both recorded privacy items were fixed rather than
carried forward.

**Objective (from `plan.md`):** the core product surface rebuilt on the approved design
language; exit = testers do their daily research in v2. **Met.**

Sub-phase 3.0 (shell + home redesign) has its own record in `post-implementation-3.0.md`
and is not repeated here.

## What was built

**The chat waves.**

| Wave | Commit | What landed |
|---|---|---|
| W1 streaming engine | `8864ac1` | `v2/runtime/chat-engine/` — v1's `useChatStream` SSE core lifted into a framework-light state machine plus a thin React adapter, parity-audited against v1 on all 20 catalogued resilience behaviours. NEW beyond v1: deltas flush into per-message `useSyncExternalStore` stores, so token arrival re-renders one row instead of the transcript — v1's biggest chat performance defect, structurally closed. |
| W2 composer wiring | `b16739a` | `v2/features/conversations/start-conversation.ts` — the strangler seam: v2 creates the conversation and writes v1's byte-compatible `conv_init` handoff. Privacy bridge for confidential/redacted sends. |
| W3 conversation screen | `f66bb7f` | `v2/features/conversations/conversation/**` — `/c/*` claimed; engine mounted with the confidential/redacted resolvers wired; 15 result cards; one activity region; scroll etiquette; native `content-visibility` virtualization (the standards' named `react-virtual` never shipped — dated correction filed in `foundation-standards.md` §5). |
| W4 cache integration | `d8bb01d` | `v2/features/conversations/cache.ts` — the one shape-aware writer over both cached list shapes; the chat↔sidebar staleness bug class structurally closed. `server.ts` adds RSC hydration of the sidebar recents. |
| W5 `/conversations` | `03a9b44` | `v2/features/conversations/list/**` on the wave-4 cache spine; archived rows inline; lint-clean search. |
| W6 device verification | — | Owner-run checklist. **PASSED.** |

**Five owner review rounds**, each against the live product rather than a mockup:
`9c905af` (§A7 items 39-44) · `24ab675` + `f699ec1` + `7c77287` (keyboard, floating pill,
tool redesign, search) · `82c2c7d` (floating composer, butter streaming, zero-result
honesty) · `759df0e` (composer scale + chip) · `e7e1c31` (the nine-step performance and
streaming round).

**Closing work, all July 25.** `b3497c1` routes cached + one conversation silhouette + no
transcript jump · `92acb99` lists check on every visit · `bd132db` cross-tab transcript
merge · `44c7a71` the backend ask · `e5a5580` `persisted_message_ids` wired, merge limit
retired, home glow removed, thinking orb added · `9adb46f` + `3b7bb36` activity row
placement and persistence · `a991dfb` home tabs become real routes
(`app/v2/work`, `app/v2/study`, `v2/shell/home-tabs.ts`) · `0b53a0e` Work and Study
rebuilt on `v2/shell/designs/sections/**` · `c06334b` both privacy items closed.

## Deviations from plan

- **`react-virtual` was never installed** and the version the standards named does not
  exist on the registry. W3 used native `content-visibility` windowing instead. The
  standards document was corrected rather than the code bent to match it.
- **Design B was deleted** and the A/B switcher graduated into real Chat | Work | Study
  product tabs mid-phase (recorded in 3.0's record; the tabs then became real routes at
  the end of this phase).
- **The Work and Study tabs were rebuilt twice** — once into a two-column workspace with
  module cards (owner #37/#38), then, at the owner's call on July 25, into a single
  column with no cards at all. The two-column frame and eleven module files were deleted
  rather than left dormant.
- **The home's ambient glow** was built, refined twice (#32, #36), fixed once more, and
  then removed outright by the owner. Do not reintroduce a decorative light without
  asking.
- **`experimental.staleTimes` was refused twice** before being adopted in the correct
  form — per-page `unstable_dynamicStaleTime`, which scopes the change to the three v2
  pages instead of re-timing every v1 route.

## Verification results

- `tsc --noEmit` clean; `eslint --max-warnings=0` clean over the v2 tree.
  (`types/admin-cases.ts` carries 3 pre-existing errors, confirmed present on the
  untouched tree.)
- `V2_ENABLED=true next build` clean — all five v2 routes correctly dynamic.
  **A build WITHOUT that flag is meaningless:** the kill switch calls `notFound()` before
  `cookies()`, so the whole v2 tree prerenders as static 404s and route classification is
  a lie. This cost a wrong diagnosis once.
- **Server-boundary verification where a browser could not be used:** `next start` was
  run and the RSC body of `/`, `/conversations` and `/c/{id}` confirmed to carry
  `"d":300` — the field Next 16.2.10's `segment-cache/bfcache.js` reads into `staleAt`.
- **On-device:** owner-run, iOS Safari + Android Chrome, reported clean.

## Known gaps / follow-ups

**Backend asks, open.**
- Deleted confidential conversations still appear in the list as contentless stubs. No
  user-facing conversation delete endpoint exists; v2 deletes the device-owned content,
  but the row survives it.
- A true in-place regenerate. "Ask again" is an honest re-send because no endpoint exists.

**Backend asks, delivered and consumed.**
- `persisted_message_ids` on every terminal stream event. They correctly overrode our
  request for `seq`, which restarts every turn and is absent from the two rows the
  feature exists for.

**Watch items.**
- `thinking-orbs` is at `0.1.x`. Small, MIT, no runtime dependencies — vendoring is a
  cheap fallback if its API moves.
- The activity orb disappears ~400ms before the last words land, because the terminal
  drain outlives `isStreaming`. Closing it means threading the reveal state up through
  `MessageList`; left until someone notices it.
- `/work` and `/study` are v2-only paths and 404 in v1 for users without the cookie.
  Closes at cutover.
- Streaming feel knobs, all tunable: `velocitySmoothingMs` 140, `catchUpTauMs` 350,
  `maxDrainMs` 400, follower ease 0.25, `publishIntervalMs` 16.

**Ops — not code, but it stopped two deploys.**
- Nightly Docker cleanup is still not enabled on the Coolify host. Settings are in
  `ops-coolify-disk-cleanup.md`.
- The host holds 29.7 GB of volumes on a 67 GB disk. Pruning buys weeks, not months; a
  resize is the real fix.

**Cosmetic, pre-existing.**
- The drawer's Search button has no handler.
- `use-conversation-stream` / `JurisdictionField` import `lib/stores/authStore` — an
  import-boundary quirk to revisit.

## Notes for the next phase

The genuinely transferable part of this phase is what went wrong. Each cost real time and
each produced a rule now enforced in code or written where the next person will hit it.

1. **We shipped a cache nobody could see.** Waves 4 and 5 built retention, optimistic
   writers and a "N new rows" pill; none of it was visible for weeks, because every v2
   route is dynamic and Next's default `staleTimes.dynamic` is `0`, so every navigation
   re-fetched the segment and `loading.tsx` covered the warm rows. **A cache is not
   shipped until you have watched a navigation with the network panel open.**
2. **Retention and freshness do not answer the user's question.** `gcTime` answers "do we
   still hold it"; `staleTime` answers "is it still good". Neither answers what a user
   asks by navigating to a list — "what is new since I was last here?" **Arrival is its
   own event** (`REFETCH_ON_VISIT`).
3. **A store cannot hold what the server must render.** The home tab lived in
   `localStorage`, so the server always rendered Chat and corrected after hydration.
   **If the server has to render it, it belongs in the URL.**
4. **Two skeletons for one screen will disagree.** One definition, every consumer.
5. **A fix can be the next bug.** A render-phase adopt added during a review raced
   `router.replace`'s echoes and ate keystrokes. **Read the installed framework source,
   not the docs, when internals are load-bearing** — the rebuild's first attempt tripped
   Next's `__NA` guard and only re-reading the router source caught it.
6. **An entrance animation without a `key` is decoration on the first item only.**
7. **Deriving beats racing.** A count read from a ref inside a `ResizeObserver` was
   correct during streaming (dozens of growths) and wrong for a single-growth merge.
8. **A review per workstream is not a review of the seams.** The whole-body review found
   two HIGH privacy findings that needed two workstreams at once to be visible.
9. **Ops is part of shipping.** Two deploys failed on a full disk a week apart, and
   `docker system df` under-reported the build cache by 13×.

**Phase 4 inherits** the section design language (`v2/shell/designs/sections/**`), the
routing pattern (real routes + per-route `loading.tsx` + `unstable_dynamicStaleTime`),
the query policy (`STALE_TIMES` / `GC_TIMES` / `REFETCH_ON_VISIT` / viewer-partitioned
keys), and the reusable list primitives `useNewRows` + `NewRowsPill`.
