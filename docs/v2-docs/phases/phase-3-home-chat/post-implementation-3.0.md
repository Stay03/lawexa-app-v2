# Sub-phase 3.0 — post-implementation record

Closed July 18, 2026, owner acceptance: "ok fine its not perfect but ill manage" (live review
of the shipped tabs). Every wave ran the standing loop: Opus implementer (research-first:
understand → v1 study → web research → refine → implement) → Opus adversarial reviewer →
coordinator fixes → tsc/eslint/`next build` → commit/push (main autodeploys, v1 byte-identical
behind the cookie).

## What was built (commit trail)

| Commit | Wave |
|---|---|
| `37a6bd4` | W1 shared chrome: real logo, v2-native notification bell (+notifications/subscription query factories), theme toggle, real user footer, A/B design switcher |
| `3e66103` | W2 two bold home designs (A "Warm Spotlight", B "Research Launchpad") + shared `use-mounted` |
| `8bbcea6` | Owner round 1 (11 fixes, §A2): v1-scale logo, plain New-chat row, seamless chrome, v1 smart-greeting engine reuse, composer furniture visible (plus-menu/workflow/jurisdiction/confidential), real recents, single-line textarea, floating B dock, instant-ish logos |
| `1e53ca8` | Owner round 2 (9 fixes, §A3): real jurisdiction picker w/ flags, v1-verbatim confidential presentation, role-aware workflows, LogoPreload, desktop hides library shortcuts, v1 prompts + focus, sidebar/drawer design pass, skeleton-first greeting |
| `4f3667c` | Owner round 3 (6 fixes, §A4): motion-SYMMETRY audit (4 one-directional transitions fixed incl. the A/B swap), infinite Recents (paginated conversations + scroll sentinel), ChatGPT-style desktop prompts / v1 mobile list, header overflow menu, centered switcher |
| `04ad56e` | Quick-fix wave (§A5 30-33): data-URI logos (the real drawer-delay fix), flag reserved-box fade + idle warming, 2.2s-precursor glow tuning, content anchor |
| `dab87d5` | T1: A/B switcher → **Chat \| Work \| Study** product tabs (home-tab store w/ intent-reflecting selection hook; ChatHome = A; B deleted) |
| `196ad03` | T2+T3: Work modules (spaces w/ §17 badges, Jump back in, Radar, chats) + Study modules (Quiz continue/stats/topics, study spaces, study-mode entry, bookmarks, chats) + `canAccessSpaces` gate fix |
| `f95b72c` | statutes-old deleted (backend's 100-node /nodes cap went live) + 429 copy on the statute reader |
| `6da0025` | Backend endpoints slotted in: Recently-viewed module (Study) + Jump-back-in on GET /api/channels w/ last_message previews |
| `89c5414` | Shared module design system (`designs/modules/`, research-documented), orphan-proof two-column layouts, 2.2s glow bloom |

## Deviations from the original §D plan

- **The A/B judging never concluded** — superseded by the owner's Chat|Work|Study pivot (§A5
  item 34). Design A became the Chat tab; Design B was deleted with its launchpad DNA absorbed
  into Work/Study. The dev switcher graduated into real product tabs.
- **Composer furniture arrived early** (owner round 2) instead of waiting for the chat waves —
  visually complete and locally interactive; network behavior still lands with the chat wiring.
- **Real data arrived early**: recents (round 2), infinite recents (round 3), and the full
  Work/Study module set (T2/T3) were pulled forward from later phases.
- Backend collaboration mid-sub-phase delivered: recently-viewed + cross-space channels
  endpoints (both consumed), the statute nodes cap (statutes-old deleted; export-akn reader
  unaffected), §17 count fields (typed + rendered).

## Standing rules born in this sub-phase (all in §A2-§A6 + memory)

Research-first subagent sequence; smooth motion → refined to SYMMETRIC motion (exits animate,
test both directions); skeleton-first (no placeholder-string flashes); keep/drop study before
any redesign (predates, enforced); v1-study-first after parity misses (the greeting lesson).

## Verification

Every wave adversarially reviewed (findings applied before each ship — including two HIGH
catches: plain-user spaces-gate leak, mobile composer below the fold). `tsc`, `eslint`,
`next build` green at every push. Curl marker `data-v2-marker="V2-HOME"` maintained
server-renderable throughout.

## Follow-ups carried forward

1. **Chat waves (next, this phase)**: engine port → wire composer → conversation screen →
   cache integration → conversations list → on-device mobile verification (§C catalog is the
   scope authority; plan.md build order stands).
2. Phase-4 statute reader on outline + ranged hydration (backend's /outline is parked awaiting
   our word; commitment recorded in memory).
3. Phase-5 realtime spine replaces polling badges (`.channel.unread` contract §17-19 answered).
4. Design polish continues by owner live feedback ("not perfect but I'll manage" = accepted,
   not finished).
