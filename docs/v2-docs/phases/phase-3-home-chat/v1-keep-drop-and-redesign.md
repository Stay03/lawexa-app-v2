# Phase 3 prep — v1 keep/drop study + shell & home redesign brief

Written July 18, 2026, after the owner reviewed the live v2 shell (commit `e53e2a0`) and asked
for the main page + sidebar to be **visibly better than v1** (not a faithful reskin), with the
**notification bell** treated as global chrome. This doc captures the first-hand study of the
three v1 surfaces (home, sidebar, header) + the conversation page, the owner's design decisions,
and the build plan — so a fresh session can execute without re-deriving any of it.

Repo baseline when this was written: `main` @ `42073e4` (phase-2 closed), clean working tree.
Nothing from this redesign is built yet.

---

## A. Owner's design decisions (binding — from this session)

1. **Ambition: meaningful redesign + GO BOLD.** Not a faithful reskin. The owner wants to see
   **TWO distinct bold home designs (A and B)**, each fully responsive (its own mobile + desktop
   treatment), and will **approve ONE**. Real components only (no static mockups — the phase-2
   "medium pivot" holds): both designs live in the v2 tree, switchable live at `/v2` via a
   dev design-switcher.
2. **Home typography = Comfortaa brand feel** (REVERSES the earlier system-sans "lock"). v1's
   actual home wraps the whole page in `var(--font-comfortaa)` — that rounded, warm Lawexa feel.
   Home greeting/prompts/hero use Comfortaa; dense UI (sidebar rows, tables, notification list)
   stays system sans. `--font-comfortaa` is already loaded in `app/layout.tsx`.
3. **Sidebar collapse = off-canvas** (keep the current v2 behavior; NOT v1's icon-rail).
4. **Logo (owner: "no logo" was a complaint):** use the REAL logo. `public/images/logo.png`
   (horizontal wordmark ~140×32) for expanded sidebar + desktop header + drawer header; a SQUARE
   mark from `public/android-chrome-512x512.png` (or `/favicons/android-chrome-192x192.png`) for
   collapsed/mobile. Keep a small muted "v2" tag so testers know it's preview.
5. **Notification bell = global, in the header, v2-native.** v1's `components/notifications/*` is
   a blocked feature component — do NOT import it. Build a v2-native bell reusing the DATA layer
   `lib/api/notifications.ts` (allowed by the boundary) via a `v2/features/notifications/queries.ts`
   factory. Bell + unread badge; dropdown on desktop, bottom Sheet on mobile; mark-read
   (optimistic per `v2/runtime/mutations.ts`); loading/empty/guest states. The realtime spine is
   still phase 5 — this is the visual+data bell now.
6. **Uncrowded header** (audit lesson): left = trigger/logo/breadcrumb-slot; right = bell + theme
   toggle + the design switcher. NO centered UpgradePill, NO context-button kitchen sink.
7. **Real user footer** (sidebar + drawer): replace the hardcoded "Adaeze Okafor / Premium" with
   the real user — from `verifySession()` (already called in `app/v2/page.tsx`) threaded to the
   shell, or `authStore` client-side (the sanctioned bridge). Real initials avatar + name + plan.

### A2. Owner's live-review decisions (July 18, 2026 — after judging waves 1-2 at /v2; binding)

8. **Logo bigger** — match v1's 140×32 wordmark scale (or slightly larger); **NO "v2" pill** anywhere.
9. **New chat = a standard nav row** (sidebar + drawer), same shape/hover as every other row; the
   ONLY difference is the label + icon in the theme gold. (REVERSES §B's earlier "keep the gold
   button" note; the drawer-footer gold pill dies too.)
10. **No horizontal chrome lines** — remove the header's bottom border and the sidebar edge border;
    seamless surfaces like v1.
11. **Greeting = v1's real smart engine** (`lib/constants/greetings/` — an ALLOWED v2 import):
    randomized holiday/day/time greetings, different per refresh, 'Welcome' fallback pre-mount.
    Desktop hero ≤ v1's ~36px. DROP the "What are we researching?" subline.
12. **Composer furniture is visible NOW, not deferred to the chat wave**: single-line initial
    height (auto-grow), jurisdiction badge, plus-menu with attach + redacted + confidential
    (privacy CONSOLIDATED in the plus-menu per §C), workflow selector (Lite/Expert). v2-native
    rebuilds (v1 components stay boundary-blocked); controls behave locally (menus open, toggles
    flip visual state), real behavior lands with the chat wiring.
13. **Recents/conversations = real data now** (read-only): a v2 conversations query factory feeds
    the sidebar Recents, drawer Recents, and Design B's recents; rows navigate to `/c/{id}`
    (falls through to v1 until the v2 conversation screen ships).
14. **Design B's mobile dock**: the composer card floats ALONE (rounded, shadowed, page visibly
    scrolling behind it) — no full-width solid band.
15. **Logos must load instantly** (eager/preloaded; skip on-demand optimization for the tiny brand
    PNGs) — the drawer's first-open logo delay is a bug.

### A3. Owner's second live-review decisions (July 18, 2026 — after the 11-fix round; binding)

16. **Jurisdiction picker = the REAL list with flags** — a v2 query over `lib/api/jurisdictions`
    (allowed), v1-parity picker UI. No static stub lists.
17. **Confidential mode presents like v1** (its heading/copy treatment, not a note appearing under
    the composer). **STANDING PROJECT RULE — smooth motion:** no UI state change may "just
    appear/disappear"; every show/hide/swap gets a deliberate, subtle transition (~150-250ms
    fade/slide), `motion-reduce` respected. Applies to ALL v2 work from now on.
18. **Workflow selector fully role-aware like v1**: users → Lawexa Lite/Expert; admin/superadmin →
    v1's full admin list. Role comes from the server session already threaded.
19. **Logos preloaded at the layout level** (drawer first-open must be instant) and **bigger: h-10**
    (40px) in sidebar + drawer.
20. **Desktop home hides the library shortcuts** (Cases/Statutes/Notes/Quiz) — the sidebar already
    provides them; mobile keeps them (the sidebar is behind the drawer there). Design B rebalances
    its desktop layout accordingly.
21. **Suggested prompts = v1's actual prompts/behavior** (study `app/(main)/page.tsx`), not
    invented ones.
22. **Sidebar design pass** (desktop rail + mobile drawer): sleeker, cleaner, deliberately
    designed — spacing, hierarchy, hover/active states, footer.
23. **Skeleton-first policy**: anything that resolves after first paint (greeting, plan line, …)
    shows a skeleton, then smoothly cross-fades to content. Never a placeholder STRING flash
    (the pre-mount 'Welcome' text was rejected).

### A4. Owner's third live-review decisions (July 18, 2026; binding)

24. **Motion symmetry (refines #17)**: every transition must animate BOTH directions — exits
    animate too, never keyed-remount enter-only patterns. Implementers AND reviewers must
    exercise the reverse direction of every state change. (Raised: confidential-mode exit was
    jumpy while entry was smooth.)
25. **Design A desktop**: content anchored toward the TOP (generous top padding), not vertically
    centered low on the page.
26. **Sidebar = fully scrollable + infinite Recents**: the conversations endpoint paginates, so
    the Recents list is an infinite list (useInfiniteQuery + scroll sentinel) that keeps loading
    as you scroll. Sidebar + drawer.
27. **Suggested prompts presentation**: DESKTOP = ChatGPT-style vertical list under the composer
    (small icon + text rows, left-aligned, quiet); MOBILE = v1's stacked list style.
28. **Header right = bell + overflow dropdown menu**: the theme toggle moves INSIDE the dropdown
    (with room for future items); it leaves the bar itself.
29. **DesignSwitch centered in the header** (mobile + web).

### A5. Owner's fourth live-review decisions + the Chat|Work|Study pivot (July 18, 2026; binding)

30. **Logos load INSTANTLY, definitively**: inline both marks as data URIs (wordmark is 6.7KB;
    downscale the 134KB/512px mark to ~96px first) — zero network, first-paint render, every
    surface. LogoPreload becomes dead code and is deleted.
31. **Jurisdiction flags**: each flag is fetched from an external CDN (jsDelivr) at render — the
    flagless flash is banned. Reserve the flag's exact box, fade each in on load, and warm the
    images in the background at low priority after the list resolves.
32. **Gold spotlight stays** (owner explicitly kept it). Mobile gets the consistent treatment:
    dimmer there + the glow fades in on its own slower curve; the tab cross-fade gets slightly
    longer/eased so switching never flashes.
33. **Design A desktop content comes DOWN a few lines** from the current top anchor (between the
    old too-low and the current too-high).
34. **THE A/B SWITCHER GRADUATES → Chat | Work | Study** (real product tabs, centered, persisted
    per device, Chat default). Design B is DELETED; its launchpad DNA lives on in Work/Study.
    Composer stays visible on all three tabs (owner did not veto).
    - **Chat** = Design A as-is (minimal introduction).
    - **Work** = work spaces (`?type=work`) with §17 rollup badges (unread_channels_count +
      mention_count — typed from the backend contract), "Jump back in" channels (per-space
      fetch now → cross-space endpoint when Ask B ships, w/ author+snippet preview),
      Radar recent activity, recent-conversations strip.
    - **Study** = study spaces (`?type=study`) w/ badges, Quiz (continue in-progress session +
      stats strip from the shipped stats endpoint + topics), study-mode CTA (student-gated,
      `study_mode` on create), recent bookmarks, conversations strip, and "recently viewed"
      reserved for Ask A when it ships.
    - Conversations have NO work/study tag (deliberately not requested — low value/cost).
35. **Backend asks A (recently-viewed) + B (cross-space my-channels) are SENT and being built**
    (their 8 clarifying questions answered July 18 — see `docs/v2-docs/backend-reply-2026-07-18-
    statutes-cap-and-asks.md`, which also records the statute nodes-cap/outline exchange and our
    release-coupled reader commitment).

### A6. Owner's fifth live-review decisions (July 18, 2026, after the tabs shipped; binding)

36. **Tab-switch gold light: slower, longer, smoother.** The glow's appearance during tab
    transitions is too fast — give it a long gentle fade (~2s class, soft ease, lingering),
    never a quick flash. Reduced-motion unchanged (instant, visible).
37. **Work/Study desktop layout is redesigned** — the shipped grid reads as a mess: the left
    column dies after the composer with a huge void, prompts orphaned at the bottom. The compose
    cluster must stay TIGHT (greeting → composer → prompts adjacent), modules composed
    deliberately around it, no dead voids, balanced columns.
38. **ONE shared module design system** (`v2/shell/designs/modules/`) replaces the drifted
    `work/primitives.tsx` + `study/parts.tsx` pair (reviewer DRY finding, now owner-visible):
    clean, sleek, research-informed card/row/badge/skeleton/empty/error language consumed by
    BOTH tabs (and future modules). Owner explicitly demanded online research/inspiration for
    this pass — module components must look designed, not assembled.

---

## B. Shell + home — keep / drop / fix (first-hand study)

### Home (`app/(main)/page.tsx`, 864 lines) vs current `app/v2/home.tsx`
- **The current v2 home is flat and unconsidered** — vertically centers everything, shortcuts
  dumped below the composer for both breakpoints. This is what "the order of things isn't there"
  refers to.
- **v1's intentional layout to honor:** MOBILE = composer docked at the *bottom* (thumb-reachable),
  greeting + suggested prompts + a 2-up library-shortcut grid stacked *above* it and scrolling;
  DESKTOP = centered hero, suggested prompts *below* the composer. The two bold designs should each
  make a deliberate, better version of this hierarchy.
- **KEEP (capabilities to port when the composer is wired in phase 3, not this design wave):**
  the full composer — attach files (PDF/DOC/DOCX/RTF, 10MB×10, drag-drop overlay, per-file status
  chips, dedup), `ComposerPlusMenu` (attach + redacted toggle), workflow selector (Lite/Expert for
  users, admin list for admins), `JurisdictionStatus` badge, study-mode toggle (students only),
  confidential/redacted modes with their own headings, guest→`AuthModal` flow, draft persistence,
  greeting via `useGreeting`, `AmbassadorProgramPopup`.
- **DROP:** the timed slide-in/out resource-link chips (State-of-Legal-Intelligence PDF + WhatsApp
  community) — gimmicky 30s show/hide timer (audit-flagged). If those links matter, place them
  statically/subtly, not on a timer.

### Sidebar (`components/layout/app-sidebar.tsx` + nav-*) vs `v2/shell/V2Sidebar.tsx`
- **Gaps:** no logo (text wordmark instead); fake user footer; off-canvas is correct (owner
  confirmed). v1 nav order (reference): New Chat, Conversations, Radar, Library{Cases, Notes,
  Statutes, Folders, Files}, My Requests, Community, Bookmarks, +Spaces/+Quiz/+Verification by
  role. v2's `nav.config.ts` is the single source — align it and add role-gating later.
- **New Chat**: v1 = a nav row; v2 = a gold button. Keep the gold button (better emphasis).
- **Recents**: currently sample data → real conversations in phase 3.

### Header (`app/(main)/layout.tsx`) vs `v2/shell/V2Header.tsx`
- v1 header: left trigger+breadcrumb, **center absolutely-positioned UpgradePill** (collision
  hazard — DROP), right = context buttons (share/reader/conversation-share on specific routes) +
  ConfidentialModeToggle + **NotificationBell** + ThemeToggle, crammed into a mobile "More"
  popover. v2 header right slot is currently EMPTY.
- **v2 header target:** logo/trigger left; bell + theme + design-switch right; breadcrumb/title
  slot in the middle-left. Route-specific actions (share, reader mode) come with those routes in
  later phases via a header actions slot — not hardcoded.

---

## C. Conversation page — keep/drop catalog (for phase-3 chat waves, NOT this design wave)

From a full study of `conversation-client.tsx` (1470 lines), `useChatStream.ts`, and the
`components/chat/*` render pieces. **The engine is the crown jewel; the render layer is the
liability.**

**KEEP / port ~verbatim (the genuinely good parts):**
- `useChatStream.ts` SSE resilience: 60s watchdog, heartbeat stale-detection (12 beats → status
  check), 3× SSE reconnect → 5s polling (10min cap), Last-Event-ID auto-reconnect, seq dedup,
  `recoverPendingState` on reload, `accumulated_text` replay. Streaming event taxonomy (v2_stream
  per-iteration placeholders, `text_delta/done/reset`, narration-vs-final heuristic, sub-agent
  buffers). Graceful cancel + partial-message preservation.
- Tool-call taxonomy (`formatToolMessage` / `tool-step-item`), `CompactToolChain`, `ToolCallDetails`.
- All inline result cards: `search-results-cards`, `statute-results-display` (harden its regex
  XML parser or move server-side), `note-link-card`, `quiz-card` (Embla MCQ), `lawyer-card`,
  `execution-plan-card` + multi-question/deep-research/next-question cards, `GeneratingIndicator`.
- User message block (rounded-3xl, click-to-reveal timestamp, >1000-char truncate, attachment
  chips), case-mention hover tooltips (make touch-friendly), init sessionStorage handoff
  (`conv_init_{id}`), confidential IndexedDB transcript engine, jurisdiction, error/connection/
  block banners + retry, view-only pill, `HandoverDisplay` sub-agent concept.

**DROP (dead / bad):**
- **Copy / ThumbsUp / ThumbsDown message actions have NO `onClick` — pure decoration**
  (`conversation-client.tsx` ~1028-1040), and hover-only so invisible on touch. Rebuild real.
- `thinking` SSE event is received but never rendered (hook ~918-921) — v2 should SURFACE a real
  collapsible reasoning trace (a visible upgrade).

**REDESIGN (keep capability, rebuild better):**
- The 1470-line god component → split into `<MessageList>` (virtualized: virtua/react-virtuoso),
  memoized `<Message*>` rows (fix the per-token whole-list re-render + ReactMarkdown re-parse —
  the single biggest perf defect), `<Composer>`, `useConversationController`.
- Composer: v1 is `position:fixed bottom-4` with JS-computed `left:{sidebarWidth}`,
  `max-w-xs sm:max-w-md` (far too narrow, narrower than the `max-w-2xl` message column), no
  visualViewport handling → keyboard occludes it. v2 = **floating composer docked in the AppShell
  dock grid row** (owner wants floating look; never position:fixed), width matched to the content
  column, keyboard-safe via the phase-1 shell mechanics.
- Message list heights use `h-[calc(100vh-120px)]` (vh not dvh) → mobile chrome miscalc. Use flex
  `min-h-0` + the shell's dvh.
- Four disjoint activity indicators (rotating phrases, narration, elapsed timer, generating pill)
  → one unified status region.
- Scroll: add sticky-follow-unless-scrolled-up during streaming (v1 only scrolls once on submit —
  users chase tokens) + jump-to-latest with count.
- Privacy split (redacted in composer +menu, confidential in shell header) → consolidate.
- Add **Regenerate** on completed answers (only retry-on-error exists today).

---

## D. Build plan for the next session (the "2 bold designs" round)

Runs under the standing workflow (Opus implementer → Opus reviewer → coordinator fixes → build →
commit/push; main autodeploys, dark-launch rules hold). Three waves:

**Wave 1 — shared chrome + design switcher (one implementer).** Everything in §A that both designs
share: `v2/shell/Logo.tsx` (LogoWordmark + LogoMark), `v2/shell/V2NotificationBell.tsx` +
`v2/features/notifications/queries.ts`, `v2/shell/V2ThemeToggle.tsx`, real user footer threaded
into V2Sidebar/V2Drawer, Comfortaa home convention, and the switcher:
`v2/shell/design-mode.ts` (`'a'|'b'` in `localStorage['lawexa-v2-design']`, default 'a', lazy
useState), `v2/shell/DesignSwitch.tsx` (A|B segmented control in the header), `app/v2/home.tsx`
renders `<HomeDesignA/>`/`<HomeDesignB/>` by mode, with STUB
`v2/shell/designs/HomeDesign{A,B}.tsx` (real-but-minimal: Comfortaa greeting + shimmer PromptInput
+ `data-design` marker) proving the switch works. (This was launched once and interrupted before
writing anything — start fresh.)

**Wave 2 — the two bold home designs (two implementers in parallel).** Each replaces its stub with
a full, bold, responsive home. Suggested distinct directions (refine as desired):
- **Design A — "Warm Spotlight":** calm/editorial; the shimmer composer as a large centerpiece
  with generous negative space and an ambient gold wash; big Comfortaa greeting; understated ghost
  suggested-prompt chips; a quiet quick-actions row. The premium-minimal bet.
- **Design B — "Research Launchpad":** the home does more — composer + an organized quick-start
  grid (Cases/Statutes/Notes/Quiz as real tiles, counts later) + a recents peek + a tasteful
  signature motion. The power-user bet.
  Both: v1 colors, original shimmer, Comfortaa home, real logo, keyboard-safe, WCAG-safe gold text,
  their own deliberate mobile vs desktop layout (owner will judge both breakpoints).

**Wave 3 — reviewer + ship.** Adversarial review (esp. transitive v1 coupling through primitives,
a11y, the bell's guest/loading/empty states, switcher persistence), fixes, `next build`, commit,
push. Owner flips A|B live at `/v2` on phone + desktop and **approves one**. The winner becomes the
home; the loser's file is deleted; the switcher can stay (dev-only) or be removed.

After approval → phase-3 chat waves proper (engine port → wire composer → conversation screen →
cache integration → mobile verification), using §C as the keep/drop scope.
