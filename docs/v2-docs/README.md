# Lawexa Frontend v2 — Documentation

Everything about the v2 overhaul lives here. The old app (v1) keeps running untouched while v2
is built behind a cookie + `proxy.ts` rewrite, visible only to researcher/admin/superadmin.

## The three master docs (read in this order)

1. **[architecture-audit.md](architecture-audit.md)** — what's wrong with v1. Full-codebase
   audit, adversarially verified against code only (Part 1 architecture, Part 2 design &
   experience, Part 3 verification record + social-preview findings).
2. **[overhaul-plan.md](overhaul-plan.md)** — how we rebuild. Locked decisions, folder
   structure, the v1/v2 switch, foundation spec, phase sequence, dark-launch working agreement.
3. **[foundation-standards.md](foundation-standards.md)** — what "done properly" means.
   Research-backed (mid-2026 primary sources) standards for Next.js 16, the data layer, design
   system, mobile/PWA, and chat/collab UX, with a decision log of stack picks.

Supporting: **[design-variations/](design-variations/)** — round-1 mockups + the binding
[round-1-feedback.md](design-variations/round-1-feedback.md).

## Phase workflow

Implementation runs in the numbered phases under [phases/](phases/). The ritual, matching the
repo's quiz/channels convention:

- **Before starting a phase**: its `plan.md` is reviewed/expanded to full task detail.
- **During**: every commit keeps v1 pixel-identical with the toggle off; `next build` before
  every push (main autodeploys to prod).
- **At close**: `post-implementation.md` records what was built, deviations from plan,
  verification results, and follow-ups. The next phase doesn't start until it's written.

| Phase | Folder | Gate |
|---|---|---|
| 0 | `phase-0-walking-skeleton` | mechanism proven in prod |
| 1 | `phase-1-engineering-foundation` | — |
| 2 | `phase-2-design-language` | ⛳ owner approves the visual language |
| 3 | `phase-3-home-chat` | testers use v2 chat daily |
| 4 | `phase-4-content-library` | — |
| 5 | `phase-5-collab-notifications` | needs backend asks (sent in phase 1) |
| 6 | `phase-6-remaining-domains` | — |
| 7 | `phase-7-cutover` | ⛳ owner flips the default; v1 deleted |
| 8 | `phase-8-admin` | — |
