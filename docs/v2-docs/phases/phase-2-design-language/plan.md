# Phase 2 — Design Language: plan ⛳ HARD GATE

**Objective:** an owner-approved visual language, encoded as `v2/design/tokens.css` +
primitives + shell chrome. Nothing in phase 3+ is built before this lands — the core screens
get built exactly once.

## Inputs (binding)

- `../..//design-variations/round-1-feedback.md`: **no mobile bottom tab bar**; conversation
  composer **floats** like v1 notes/cases pages; **shimmer must match the current
  `.gold-shimmer` exactly** (side-by-side acceptance); **C — Chambers Slate closest**.
- `foundation-standards.md` §3 (token architecture, type roles, motion tokens, elevation,
  radius discipline, gold ramp with text-safe dark step, a11y bar) — the engineering constraints
  every candidate must satisfy.
- Brand anchors: gold oklch hue 82 / `#C9A227`; Fraunces + Comfortaa available; Lucide icons.

## Process

1. **Round 2 mockups**: start from Chambers Slate's direction, corrected per feedback —
   floating composer, exact shimmer port (copy the real gradient stops/durations from
   `globals.css`, compositor-only mechanics), and 2–3 **mobile nav alternatives** to react to
   (e.g. floating dock, minimal contextual top nav, gesture sheet — anything but the rejected
   tab bar and the hamburger-only status quo).
2. Owner reviews → targeted iteration rounds (small diffs, not new directions) until approval ⛳.
3. **Encode**: `v2/design/tokens.css` (@theme architecture per standards §3, incl.
   `--radius-DEFAULT`), primitives (Radix-pinned shadcn, `new-york`, tokens-only styling),
   shell chrome (sidebar, header, mobile nav, breadcrumbs) on the phase-1 mechanical shell.
4. Contrast pass (WCAG math on every token pair used for text) + reduced-motion pass +
   forced-colors pass.

## Exit criteria

Owner approval recorded here (date + what was approved); tokens/primitives/shell merged;
side-by-side shimmer acceptance passed; a one-page "language spec" section appended to this
file for phase-3+ builders.

## Owner decisions — round 2 (July 17, 2026)

1. **Shimmer: THE ORIGINAL.** Owner A/B'd `round-2/shimmer-parity.html` and chose the original
   `background-position` implementation over the compositor rebuild. v2 ships the verbatim
   `.gold-shimmer` CSS (all four variants, exact stops/timing). Permitted invisible-only
   safeguards: `prefers-reduced-motion` static ring, `animation-play-state: paused` off-screen.
   The compositor rebuild is retired (kept in the parity file for the record).
2. **Mobile nav: D — the drawer** (ChatGPT-style slide-in: nav rows + scrollable Recents as one
   region, pinned New-chat pill + avatar). Variants A/B/C retired.
3. **Overall direction verdict: Chambers Slate REJECTED** (owner: "the only thing I want from
   this is the shimmer and the sidebar thing; every other thing including the font is ugly.
   I prefer the color of the v1"). New direction for round 3: **v1's visual identity kept** —
   v1's exact color tokens (the oklch `:root`/`.dark` sets in `globals.css`), v1's soft shape
   language (near-pill controls, `rounded-2xl` ringed cards, the real composer treatment), v1's
   current typography (system sans; Comfortaa wordmark only) — executed *consistently* (one
   scale, one radius per component class, disciplined spacing), PLUS the locked keepers:
   original shimmer verbatim, the drawer (Nav D), the floating conversation composer.
   Slate surfaces, Geist/Geist Mono, and the R2 density are all retired.

## Round 3 verdict + THE MEDIUM PIVOT (July 17, 2026)

Round-3 mockup: **colors approved** (v1 palette verbatim stays); the mockup's execution
rejected ("definitely not the design — it sucks"). Owner confirmed the real component stack:
**shadcn/ui + prompt-kit**.

**Decision — no more static HTML mockups.** Three rounds proved the medium can't represent
shadcn/prompt-kit quality. Phase-2 design iteration moves onto REAL components in the live v2
tree behind the owner's toggle:

- **Primitive layer (final):** the existing shadcn `components/ui/**` and `components/prompt-kit/**`
  are v2's shared primitives — the import-boundary exception for them becomes permanent policy
  (they are library-derived primitives, not v1 feature code). No separate v2 primitive fork.
- **Tokens:** v1's `globals.css` tokens ARE the v2 tokens (already inherited). No new tokens.css;
  consistency is enforced at the component/usage layer.
- **Locked:** original shimmer verbatim; drawer (ChatGPT pattern) on mobile; floating
  conversation composer; system sans + Comfortaa wordmark; v1 shapes.
- **Next build:** the real v2 shell + home (shadcn sidebar, prompt-kit composer + shimmer,
  drawer) — owner reviews the deployed product at /v2, and design tweaks iterate there.
  This merges the phase-2 exit into the start of phase-3 construction.

## ⛳ GATE PASSED — owner approval (July 18, 2026)

The live shell + home (commit `e53e2a0`, deployed behind the toggle) was reviewed by the owner
in prod: **"I've checked it and it all looks good."** Phase 2 is CLOSED. The approved baseline:
v1 tokens verbatim · shadcn `components/ui` + `components/prompt-kit` primitives · original
gold-shimmer · ChatGPT-style drawer · uncrowded header · nav fallthrough to v1 pages. Design
refinements continue by iteration on the live product during phase 3+.
