# Lawexa Frontend v2 — Documentation

Everything about the v2 overhaul lives here. The old app (v1) keeps running untouched while v2
is built behind a cookie + `proxy.ts` rewrite, visible only to researcher/admin/superadmin.

## Why v2 — the north star (read first, applies to everyone incl. subagents)

**v2 exists to keep the Lawexa codebase and system clean — no compromises.** v1 grew fast and
accumulated mess; v2 is the chance to do it *properly*: clean architecture and clean code AND
polished, deliberate UI/UX, with every part of the system given real attention — never "good
enough." Concretely: no hacks, no `any`, no TODO punts; break each phase into subphases so nothing
is rushed; study each v1 screen before redesigning it. **Coordinators must state this mission in
every implementer/reviewer subagent brief** (subagents don't read this file).

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

- **Break each phase into subphases/waves** (standing rule): never build a phase as one lump —
  decompose it so every part gets proper attention and is properly implemented, each subphase its
  own implement → adversarial-review → verify → ship loop. Record the breakdown in the phase
  `plan.md`. (e.g. phase 3 → 3.0 shell+home redesign, engine port, wire composer, conversation
  screen, cache, mobile-verify.)
- **Before starting a phase**: its `plan.md` is reviewed/expanded to full task detail.
- **Before redesigning ANY page/screen** (standing rule, every session): first do a first-hand
  **keep / redesign / drop study** of its v1 counterpart — element by element, its components and
  data, what stays as-is, what gets rebuilt better, what dies. Write the verdicts into the phase
  doc BEFORE building, so the redesign is deliberate and the record is consistent across sessions.
  Example: `phases/phase-3-home-chat/v1-keep-drop-and-redesign.md` (home/sidebar/header/conversation).
- **Research-first implementer sequence** (standing rule, every implementer brief): each
  implementer works in order — understand the existing code → study the v1 counterpart
  first-hand → web-research the patterns being implemented → refine the approach → implement.
  Born of parity misses (v1's smart-greeting engine was reinvented before v1 was read). Origin:
  `phases/phase-3-home-chat/v1-keep-drop-and-redesign.md` §A2 + `post-implementation-3.0.md`.
- **Smooth + SYMMETRIC motion** (standing UI rule): no UI state change appears or disappears
  abruptly — every show/hide/swap gets a deliberate ~150–250ms transition that animates BOTH
  directions (exits too; keyed-remount enter-only patterns are banned), `motion-reduce` respected.
  Implementers AND reviewers exercise every toggle both ways. Origin: same doc §A3 item 17 +
  §A4 item 24.
- **Skeleton-first** (standing UI rule): anything that resolves after first paint renders a
  skeleton that cross-fades to content — placeholder STRINGS are banned (the pre-mount 'Welcome'
  text was rejected), and error states are distinct from empty states. Origin: same doc §A3
  item 23 + the shared module conventions (§A6 item 38).
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
