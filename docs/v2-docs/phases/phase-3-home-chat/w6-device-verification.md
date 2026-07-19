# W6 — on-device verification checklist (closes the phase-3 gate)

**Who:** the owner + researcher testers, on REAL devices — iOS Safari (a notched iPhone) and
Android Chrome. Simulators don't reproduce the keyboard/viewport behaviors this list exists to
catch. **When:** against prod with the `lawexa-ui=v2` cookie, at HEAD ≥ `03a9b44`.
**How to report:** note device + OS + step number for anything that fails; the fix loop picks
them up from there. The metadata half of the original W6 scope (conversation
`generateMetadata`/OG in the v2 convention) shipped with W3 — this checklist is the remaining,
human half.

## A. Keyboard correctness (the reason W6 exists)

1. Home → tap the composer. The composer must rise ABOVE the keyboard (no occlusion, no
   document scroll-jump). Rotate to landscape and back with the keyboard open.
2. `/c/{id}` → tap the dock composer. Same: floating card above the keyboard, transcript
   scrollable behind it, no layout jump when the keyboard dismisses.
3. iOS specifically: toolbar collapse/expand while scrolling a long transcript — the dock must
   stay pinned; no white strip under the home indicator.
4. Type multi-line (composer auto-grow) with the keyboard open — the input caps and scrolls
   internally; the send button stays reachable.
5. `/conversations` → focus the search field. NO page zoom on focus (16px input floor); the
   list scrolls under the keyboard; clearing search with the keyboard open doesn't jump.

## B. Safe areas + 320px floor

6. Notch/home-indicator: header content clear of the notch (portrait + BOTH landscape
   orientations); the dock clear of the home indicator on `/c/{id}`; the drawer's footer
   likewise.
7. Smallest supported width (or iPhone SE / 320px emulation as a floor check): header
   (tabs on home; title + confidential badge on `/c/{id}`) never collides with the side
   clusters; conversation rows truncate rather than overflow.

## C. Touch interaction

8. All primary targets comfortably tappable (44px rule): nav rows, recents rows, composer
   buttons, the search clear button, the confidential Delete control, "Open case" in the
   case-preview popover.
9. Case-mention TAP on a phone: opens the preview popover (does NOT navigate); "Open case"
   inside it navigates; tapping outside dismisses with a smooth close. Long-press on the
   mention still offers the OS link menu.
10. Tool-call chain: expand a step's details, collapse it; "N tool calls completed" →
    show-all → collapse — every transition smooth BOTH directions, nothing jumpy.
11. Sidebar drawer: open/close feel, Library collapse/expand animation both directions,
    infinite Recents keep loading as you scroll, tap a recent → conversation opens.

## D. Flows (end-to-end on the device)

12. Create a conversation from home (each of Chat|Work|Study tabs' composer) → streams on
    `/c/{id}` → the new conversation appears in the sidebar recents IMMEDIATELY (no refresh).
13. Send a follow-up on an older conversation → it jumps to the top of recents without a
    refresh; its AI title upgrade appears without a refresh.
14. Confidential flow: create confidential from the + menu (copy reads "Stored only on this
    device until you delete it"), stream, reload mid-conversation (transcript survives),
    then Delete from the banner → confirm → lands home, transcript gone, recents clean.
15. `/conversations`: infinite scroll loads early (no skeleton flash at the very bottom),
    search filters with the URL updating, archived rows show their badge, a confidential
    row shows the emerald identity, tapping any row opens it.
16. Guest pass (signed-out device): home renders, `/conversations` shows the sign-in state,
    nothing crashes.

## E. Both themes + motion

17. Repeat a spot-check of C/D in dark mode (emerald confidential language, gold accents,
    banners legible).
18. With OS "reduce motion" ON: transitions settle instantly (no half-animations), nothing
    breaks.

**Gate:** when this list passes on both platforms and the testers are doing their daily
research in v2 chat, phase 3 closes — write `post-implementation.md` and open phase 4.
