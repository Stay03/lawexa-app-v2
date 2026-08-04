# Spaces/Channels v2 — group-messaging design research (2026-08-04)

Owner-directed research done BEFORE drawing any W2+ screen (owner, Aug 4). Two web
sweeps: product anatomy (Slack, Discord, Telegram, WhatsApp, Teams, Campfire, Zulip,
Twist, Quill, Linear, Missive) and design principles (NN/g, W3C APG, Soueidan,
Roselli, 37signals, Doist, slack.design, microsoft.design, linear.app). The
owner-facing report with drawn specimens is the artifact "Clean group chat —
research for Spaces v2"; this file is the implementer version. **The DIRECTION
section is binding for W2/W3 briefs.**

## The finding

Calm is a notification model and a reply model before it is a visual style. The
products called "calm" (Twist, Zulip, Campfire, Linear) earn it structurally: who
gets interrupted, what must be named, where replies live. The products called noisy
(Discord, Teams, post-2023 Slack) lost it structurally and are now walking it back
— Discord's own 2025 refresh brief was "reduce the feeling of being overwhelmed by
visual noise"; Microsoft admitted Teams' crowded controls cause accidental
screen-shares; Slack's 2023 surface-splitting (Home/DMs/Activity) drew sustained
backlash for fragmenting where messages live.

## DIRECTION (binding)

1. **Rows, not bubbles.** Full-width grouped rows (avatar + bold name + quiet
   timestamp once per author-run; 5-min window as in v1). Two type weights total.
   Message text column ≤ ~66ch.
2. **Two-tier unread, gold not red.** Bold + gold dot = unread. Numeric badge =
   mentions only. Muted = dimmed, never bold, badge only for direct @you (backend
   Ruling A matches exactly). No red counts anywhere; red is reserved for failure/
   destructive.
3. **Unread divider** = gold hairline + "New" label at the first unseen message;
   land at the line when unreads exist, else bottom. Day dividers = plain hairline.
   Exact timestamps on hover (relative in feed, absolute on hover + day headers).
4. **Replies are inline quotes in the feed. NO side-thread panel.** Evidence:
   slack.design's own threads post-mortem (hiding replies traded discoverability
   for readability) + persistent user complaints; Telegram's Reply Revolution is
   the target interaction — compact quote on the bubble, tap the quote → jump to
   original with highlight (our `?m=` + `reply_to.uuid`).
5. **Reactions are quiet chips** (hairline border, gold on `reacted_by_me`), never
   notify (Campfire Boosts precedent — visible response, zero interruption). Pins
   get a small pinned surface off the channel header. Row actions: hover on
   desktop, long-press sheet on touch (Apple HIG) — never permanent per-row
   toolbars.
6. **Interruption ladder (spine contract, W1):** visible channel → inline only.
   Elsewhere plain message → badge/bold only, no toast, no sound. @you elsewhere →
   badge + toast (+ sound only if enabled; D8 = off by default). Muted → nothing
   except badge on direct @you. Reactions/typing/presence → never notify.
   Toast for arrivals is banned; the ONE justified toast family is actionable
   failures, persistent until dismissed and mirrored inline (Roselli).
7. **Presence softened:** quiet "N online" in the channel header; no green dots on
   avatars; typing = one line above the composer, never stacked bubbles
   (37signals/Twist: presence pressure is a design failure).
8. **One tuned density, light + dark.** No density knobs, no theme zoo (Discord
   counter-example). One accent doing all signal work (Linear/Telegram pattern —
   already the house rule).
9. **Failed send:** optimistic insert → subtle `sending` → nothing → `failed` (red
   icon + Retry inline, never silently dropped, never auto-dismissed).
10. **Scroll contract:** auto-follow only at bottom; scrolled up → gold "N new
    messages" pill (count since detach); history prepends preserve position; new
    messages NEVER move focus or viewport.
11. **A11y recipe (W2 acceptance criteria):** feed wrapped in `role="log"` (polite,
    pre-mounted before messages arrive); WAI-ARIA feed pattern for keyboard
    traversal (`role="article"` rows, PageUp/Down, Ctrl+Home/End,
    `aria-posinset`/`aria-setsize`, `aria-busy`); timestamps/metadata ≥4.5:1 in
    both themes (quietness from size/weight, not contrast); all motion ≤~200ms,
    symmetric, motion-reduce honored.
12. **Mobile:** composer rides the keyboard via the shell's measured-occlusion
    mechanism + `env(safe-area-inset-bottom)` when closed; primary actions in the
    thumb zone; long-press sheets with Cancel, destructive in red.
13. **Empty states teach + act:** channel purpose, who's here, one primary action
    ("Write the first message" focuses the composer). Never a blank pane.
14. **One feed per channel, one triage point (the bell).** No Activity/Later/
    Threads satellite surfaces (Slack 2023 lesson).

## Evidence highlights (with sources)

- Slack threads journey: inline expansion failed, overlay failed, side panel won,
  and hiding replies from the channel was "the single most meaningful change" —
  bought readability, cost discoverability (slack.design/articles/threads-in-slack-
  a-long-design-journey-part-1-of-2/ and part-2). Optional threading goes unused
  socially (blog.elest.io/why-remote-teams-are-switching-from-slack-to-zulip-
  threading-changes-everything/; HN 25335117, 27149487).
- Telegram Reply Revolution: precision quoting, animated jump-to-source, quotes can
  cross chats (telegram.org/blog/reply-revolution).
- Twist's deliberate removals: no presence, no read receipts, unnumbered unread
  dots, per-thread opt-in notifications (medium.com/ten-timezones/designing-twist-
  the-challenge-of-making-teamwork-less-stressful-bdd5b440a223). Validates D2/D8.
- Campfire Boosts: reactions that never notify (once.com/campfire;
  pinkeyegraphics.co.uk/campfire/).
- Slack 2023 redesign backlash: surface-splitting fragmenting attention
  (slack.com/blog/productivity/a-redesigned-slack-built-for-focus;
  fastcompany.com/90972862).
- Discord 2025 refresh stated goal: "reduce the feeling of being overwhelmed by
  visual noise" (discord.com/blog/player-release-q12025). Muting that doesn't fully
  silence is a top Discord complaint — our Ruling A must be exact.
- Teams: white canvas, brand purple dialed back, button-by-button justification
  audit (microsoft.design/articles/designing-the-new-era-of-teams/); crowded
  controls → real mis-clicks admission (xda-developers.com).
- Linear redesign: alignment discipline, desaturated LCH accent, 3-variable themes
  (linear.app/now/how-we-redesigned-the-linear-ui).
- NN/g: badges are passive/informational; match interruption to urgency
  (nngroup.com/articles/indicators-validations-notifications/); animation 100–300ms
  (nngroup.com/articles/animation-duration/); empty states teach + act
  (nngroup.com/articles/empty-state-interface-design/).
- A11y: role="log" polite live region, pre-mounted (sarasoueidan.com/blog/
  accessible-notifications-with-aria-live-regions-part-1/); APG feed pattern
  (w3.org/WAI/ARIA/apg/patterns/feed/); toasts widely missed, WCAG risks
  (adrianroselli.com/2020/01/defining-toast-messages.html); muted text still needs
  4.5:1 (WCAG Understanding 1.4.3).
- Scroll contract convergence: shadcn Message Scroller docs + TanStack Virtual chat
  example + Discord user complaints about viewport yanking.
- 37signals "Group Chat: The Best Way to Totally Stress Out Your Team"
  (basecamp.com/guides/group-chat-problems): chat multiplies perceived load; green
  dot = "butts in seats"; "If the design leads to stress, it's a bad design."
- Timestamps: relative in feed + absolute on hover (uxmovement.com; GitHub Primer
  RelativeTime; Cloudscape timestamp pattern) — legal audience needs "when exactly."
- Mobile keyboard: visualViewport/dvh + safe-area variable pattern
  (franciscomoretti.com/blog/fix-mobile-keyboard-overlap-with-visualviewport);
  thumb zone (smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/).
- Quill (dead, instructive): retroactive threads, priority vs passive mentions,
  one Activity control center (techcrunch.com/2021/02/23/the-new-new-slack-quill/).

## The no-list (paste into every W2/W3 brief)

No hidden side-threads · no red unread counts · no per-row permanent toolbars · no
density/theme knobs · no toast/sound for plain arrivals · no green-dot presence on
avatars · no read-state display (D2) · no surface-splitting of messages · no
engagement mechanics (read pressure, streaks) · no yanking the viewport · no focus
theft on arrival · no blank empty states · no sub-4.5:1 metadata text.
