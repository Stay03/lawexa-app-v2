# phase-2-design-language — post-implementation

Closed: July 18, 2026 (owner approved the live shell in prod). The phase took an unusual path —
three static-mockup rounds, then a pivot to iterating on the real product — recorded here so
future phases skip the detour.

## What was decided (the approved language)

- **Colors/tokens:** v1's `globals.css` oklch sets, verbatim, both themes. No new tokens file —
  v1's tokens ARE v2's; consistency is enforced at the usage layer.
- **Primitives:** the existing shadcn `components/ui/**` + `components/prompt-kit/**` are the
  permanent shared primitive layer (eslint boundary exception documented in config). No fork.
- **Shimmer:** the ORIGINAL `.gold-shimmer` CSS verbatim (owner A/B'd a mathematically identical
  compositor rebuild via round-2/shimmer-parity.html and chose the original). Only invisible
  safeguards permitted (reduced-motion static ring, off-screen pause).
- **Mobile nav:** the ChatGPT-style drawer (nav + scrollable Recents as one region, pinned gold
  New-chat pill + avatar). Bottom tab bar and round-2 variants A/B/C rejected.
- **Composer:** home = in-flow with shimmer (v1 treatment); conversation = FLOATING (detached,
  rounded, shadowed) on the AppShell dock grid row — never position:fixed.
- **Typography:** v1's system sans at a cleaned scale; Comfortaa wordmark only. Geist, Fraunces,
  mono citations all rejected.

## What was built (the approved artifact)

Commit `e53e2a0`: `v2/shell/nav.config.ts` (single nav source, clean canonical hrefs falling
through to v1), `V2Sidebar` (shadcn primitives), `V2Drawer`, `V2Header` (uncrowded),
`app/v2/home.tsx` (real prompt-input composer + shimmer, inert). Reviewer: SHIP, 0 blockers;
transitive v1-store coupling through primitives verified ABSENT; fixes: drawer focus-restore,
variant-matched width overrides, nav fallthrough hrefs.

## Deviations from plan

- The plan's "round-2 mockups → approval → encode tokens.css" flow died at round 3: static HTML
  could not represent shadcn/prompt-kit quality (owner: "this is definitely not the design…
  we are using shadcn and prompt-kit right?"). The MEDIUM PIVOT replaced encoding with reuse:
  no `design/tokens.css`, no v2 primitive fork. Standards §3's token-architecture guidance is
  superseded accordingly for colors/primitives (motion/a11y guidance still applies).
- Round-1/2/3 mockups remain in `design-variations/` as the decision record.

## Verification results

Live owner review in production (desktop + mobile) after full pipeline verification
(tsc/eslint/build green; runtime curl matrix; headless-Chrome renders; adversarial review).

## Known gaps / follow-ups

1. Composer is inert; nav Recents/user footer are sample data → wired in phase 3.
2. Greeting is hardcoded "Good evening" (time-of-day greeting exists in v1 `useGreeting`) →
   phase-3 nicety.
3. Reduced-motion/off-screen safeguards for the shimmer not yet applied in v2 usage → phase-3.
4. Round-2 drawer/search icon is decorative → real search lands with conversations data.

## Notes for the next phase (phase-3-home-chat)

Build on the approved shell exactly as deployed; do not restyle primitives. Design tweaks come
only from owner feedback on the live product. The dock slot awaits the floating composer.
