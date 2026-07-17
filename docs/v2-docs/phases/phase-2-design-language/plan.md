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
3. Overall direction verdict (Chambers Slate R2 as the language to encode): PENDING owner
   confirmation.
