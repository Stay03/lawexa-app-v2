# Frontend plan — three channel states, invite links, waiting lists, public spaces

Written 2026-08-10 against `Stay03/lawexa-api-v3` →
`docs/api/spaces-channels-invite-links.md`, which went live in commit `36a2c54`
at 07:38 UTC the same morning.

**Nothing in here is built. This is for @staynjokede to review first.**

---

## 1. Three things our app says today that are now untrue

These are live right now. They are words, not features, and they are wrong the
moment somebody reads them — so they should ship on their own, before any of the
new screens.

**a. The create-channel dialog describes Private as hidden.**
`v2/features/spaces/dialogs/ChannelFormDialog.tsx` offers:

> **Private** — Invite only. It stays hidden from the rest of the space.

That was accurate yesterday. As of this morning it is false: private now means
**listed by name and locked**, and *hidden* is a separate third state. So anybody
creating a private channel through our UI today is promised invisibility and does
not get it.

This is the same trap @backendclaude spent yesterday clearing. He migrated the 17
existing private channels to `hidden` precisely to keep the promise they were made
under — but our dialog goes on making that promise to every **new** channel.

**b. The space form and the space page disagree with each other.**
`SpaceFormDialog.tsx` offers "Open — Anyone can find it and join without an
invitation." `SpaceLobbyBlocks.tsx` renders that same state as "Open to the
organization". One setting, two meanings — and on a personal space with no
organization the second is meaningless. Until this morning the flag did nothing,
so the disagreement was harmless. **It is not harmless now.**

**c. The old app's switch never says what "off" does.**
`components/collab/SpaceFormDialog.tsx` shows a switch labelled "Private space —
Only invited members can find and join it", and nothing anywhere states the
consequence of turning it off. Turning it off now publishes the space. Two of the
three accidentally-public spaces were created this way.

**Effort: half a day. Ships alone, no API work, no dependency on anything below.**

---

## 2. What the app does not know exists yet

| Thing | Our code today |
|---|---|
| `hidden` channel state | `ChannelVisibility` is a two-value union in `types/collab.ts` |
| Public spaces | no browse, no self-join |
| Invite links | no preview screen, no create/manage panel |
| Space waiting list | nothing |
| Channel waiting list | nothing |
| Only admins create channels | needs checking against our gate |

Adding `'hidden'` to the union is deliberately the first move: **every exhaustive
switch stops compiling, and that is the list of places needing a decision.** It is
cheaper to let the compiler find them than to grep for them.

---

## 3. Build order, and why

**Step 1 — Channel visibility, three states. ~½ day.**
Type gains `hidden`. Create and edit dialogs get an honest third choice. Glyphs:
`#` open, lock private, eye-off hidden.
**A hidden channel must render as "not found", never "you don't have access"** —
the API returns `404` for exactly this reason, and a "no access" message would
confirm the channel exists.

**Step 2 — The invite link landing page. ~1 day. The highest-value piece.**
A new route that must work **signed out and as a guest**.
Everything hangs off `viewer_action` from the preview: `sign_up`, `verify_email`,
`join`, `request`, `already_member`. The button is correct on the first press, so
nobody is refused after pressing.
`404` and `410` get different words — "doesn't exist" vs "expired, ask for a new
one" — because a lapsed invite is not a wrong one.

> **This step carries the one real risk in the plan.** Holding the invite code
> through sign-up *and* email confirmation means reading stored state on a fresh
> page load. That is the exact shape of the onboarding bug from July: zustand
> serves its empty initial state during hydration, so a guard that reads it inside
> an effect sees nulls and acts on them. I will gate this at render, never in an
> effect. Flagging it now because it is invisible until it strands somebody
> mid-signup, and the person it strands is a brand new user.

**Step 3 — Creating and managing links. ~½ day.**
A panel in the space: create (optional channel, role, approval, max uses, expiry),
list with use counts, revoke.

**Step 4 — The two waiting lists. ~1 day.**
Admin: list, approve, reject — bound on the row's `id` **read from the response**,
never constructed. (@backendclaude shipped a fix specifically because that `id`
was missing and 30 green tests missed it.)
**`also_joins_channel` must be stated on the approve control.** When present,
approving a space request also grants a channel. An admin who is not told that
hands out access they never agreed to.
Member side: "Ask to join" on a private channel. Pressing twice returns `200` and
is a **success**, not an error.

**Step 5 — Public spaces: browse and join. ~1 day.**
Discover list with search; self-join. Guests may read but not join or write, and
the refusal has to be explained rather than silent.

**Total ≈ 4 days, plus the half day in §1 which goes first and ships alone.**

---

## 4. The traps, collected

- **A guest is not logged out.** Guests carry a real token and pass auth. Decisions
  must read `viewer_action`, never "do I have a token".
- **Hidden must look non-existent.** `404` means "not found", full stop.
- **`already_member` and `already_waiting` are successes.** Pressing twice is not
  an error.
- **Approval that also grants a channel must say so before the press.**
- **Guests can never join.** Hold the code, complete sign-up, then accept.

---

## 5. What I need from @staynjokede

1. Approve the order, or change it.
2. Confirm §1 ships immediately and separately. Those three are wrong on the live
   site right now, and they are only words.
