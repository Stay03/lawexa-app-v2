# Design variations — round 1 feedback (July 17, 2026)

Three mockups were presented (same two screens, same copy, light/dark, desktop + mobile):
`a-counsel-gold.html`, `b-law-report.html`, `c-chambers-slate.html`.

**Owner verdict: none accepted as-is.** Binding feedback for round 2 (phase-2-design-language):

1. **No bottom tab bar on mobile.** "It's a mess." The mobile navigation pattern is an open
   design question — do not bring the tab bar back. Constraint that survives from research:
   don't hide all primary navigation behind a single hamburger either.
2. **The conversation composer must be bottom-FLOATING**, visually like the current v1
   notes/cases pages — not a flush docked bar. (Engineering note: the floating look is styled
   on the keyboard-safe grid row; `position: fixed` stays banned. See foundation-standards §4.)
3. **The shimmer must match the current one exactly** — look and behavior. None of the three
   rebuilds matched the real `.gold-shimmer` in `app/globals.css` (gradient stops, speed,
   focus-within variant, light/dark). Round 2 acceptance = side-by-side visually
   indistinguishable, while staying compositor-only.
4. **C — Chambers Slate was the closest** overall direction of the three.

Round 2 does not start until phase-2; the engineering phases (0–1) run on existing v1 tokens.
