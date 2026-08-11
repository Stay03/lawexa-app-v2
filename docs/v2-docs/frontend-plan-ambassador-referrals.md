# Frontend plan — ambassador referrals

Rewritten 2026-08-11 02:10 UTC, after a full audit of the contract against this
codebase and after @backendclaude answered it.

Sources: `Stay03/lawexa-api-v3` → `docs/api/ambassador-referrals.md` and
`docs/api/spaces-channels-invite-links.md`. Every claim about **our** code below
names the file it was checked against.

---

## Status of the two items that came first

Both **DONE and pushed** (`8cd6d1e`), 01:38–02:22, 44 minutes.

- **Referral capture no longer depends on luck.** `getStoredAttribution()` now
  captures before it reads (`lib/utils/attribution.ts`), so the code is present
  on the guest call regardless of React's effect order. This was the one thing
  in the whole feature that could not be repaired after the fact.
- **Membership lines are furniture.** Own feed item, day-label grammar, distinct
  glyphs for left vs removed, and they close the author run
  (`v2/features/channels/feed-model.ts`, `feed/FeedDivider.tsx`).

---

## What the audit changed about this plan

The audit was not a formality — it found two **backend bugs** that were wearing
the costume of labelling questions, both being fixed tonight:

- **`revenue` was not money.** Payments in naira and dollars were summed into one
  number: "139,200 naira plus 17 dollars" became 255,221 of nothing. It becomes
  revenue **per currency**. This is why the field could not be labelled — it was
  not a real quantity.
- **`referred_count` double-counted almost everybody.** A guest row was counted,
  then a second row at registration. One person who clicks and joins counted as
  two. It becomes people who actually created an account, and **the number will
  go down** — that is the fix working.

Also being added after the audit: `busiest_day` becomes a date **and** a count,
the ambassador gets their own last-referral date, per-code counts so a retired
code can prove it still brings people, a confirmed/received-the-pack count, and
a typed row identity for the admin table.

**Nothing may be built on `revenue` or `referred_count` until he says the shapes
are settled.** Building against a field that is about to change is how a screen
ships with a number nobody can explain.

---

## Phase 1 — The ambassador's own screen (≈ ¾ day)

Blocked on nothing. Uses only the code endpoints, which are stable.

### 1a · Types and the data layer
`types/ambassador.ts` gains the code + performance shapes; `lib/api/` gains the
three calls; a `v2/features/referrals/queries.ts` in the `v2/features/invites/`
shape. `revenue` is typed `string` and stays a string forever.

### 1b · The door — who even sees this
`GET /api/ambassadors/my-application` decides it, **not a user role**. There is
no ambassador role and there will not be one; roles are a priority ladder and
inserting one changes the meaning of every existing check.
The v2 rail cannot host the entry as it stands: `nav.config.ts:79` types
`canAccess` as a pure `(role) => boolean` and the module forbids queries in the
shell config. So either the rail grammar is extended, or the entry lives where
the app already knows the person is approved — the "You're in" card on the
static apply page (`public/ambassadors/integration.js:121`), which is a dead end
today.
**Needs a decision — see Open questions.**

### 1c · The claim form
Claim and change are one call. `409` taken, `422` use the server's sentence,
`429` slow down. **Display the code the API returned, never what was typed** —
codes are stored lowercase, and a code that renders differently from how it
resolves is a bug report waiting to happen. No client-side availability check
exists, and the refusal is honest, so the form submits and reports.

### 1d · The code card and the share link
The current code, `lawexa.com/?ref={code}`, a copy control, and **the retired
codes**, because a printed face card carries a code that must keep working.
Once per-code counts land, each retired code shows what it still brings — until
then the card may state the code is still live but **must not imply a number it
does not have**.

### 1e · The numbers, honestly
`referred_count` and `paid_count` only, with `paid_count` labelled as *ever paid*
— it excludes refunds, unconverted trials, the free plan and gifts, including
the welcome pack. **No earnings, no commission, no implication of either**: the
API deliberately has no earnings concept and nobody has decided ambassadors are
paid anything.

---

## Phase 2 — Admin financials (≈ 1 day) — BLOCKED until the shapes settle

### 2a · Route and navigation
`/admin/ambassadors/financials`, a new `contentNavItems` entry, and
`excludePaths: ['/admin/ambassadors/financials']` on the existing Ambassadors
item — the exact precedent is Cases at `components/admin/admin-nav-content.tsx:42`.
Reuses `components/admin/observability` primitives, as `/admin/operations` does.

### 2b · The table
Per-currency revenue when it lands. Zero-referral ambassadors **stay in the
list**: "did nothing" and "not in the list" are different answers.

### 2c · The traps, all of them stated so they cannot be walked into
- `revenue` is a decimal **string**. Format it; never parse it, never sum it,
  never derive from it. `totals` exists so the client never does money arithmetic.
- `revenue` is **what referred people spent**, not commission. The column may not
  be called Earnings or Owed.
- `gifted_messages` is a **count of messages**, not money. Any naira figure is
  invented.
- `unusual_activity` is **a prompt to look, not an accusation** — a lecture-hall
  demo trips it exactly as farming does. No red, no "Flagged" filter tab, no
  default sort by it.

---

## Phase 3 — The share promise (small, but it is live and it is wrong)

`public/ambassadors/integration.js:316` shares the words *"Sign up here and get
10 free messages to start"* on a URL carrying `utm_campaign=ambassador-10-free`
and **no referral code**. The pack is granted on referral attribution. So the
promise is, as far as this side can tell, empty today.

Not fixed unilaterally: it is live marketing copy and the choice between
*remove the promise* and *move the button behind an approved ambassador with a
code* belongs to the owner. Asked, with the backend question that decides it
(does that `utm_campaign` grant anything at all?).

---

## Phase 4 — The face card (deferred, flagged)

`public/ambassadors/face-card/index.html` contains **no referral code**. Today's
printed cards therefore carry nothing to credit anybody — the feature's most
physical distribution channel does not distribute the code. Wiring it means
extending the deliberately React-free static page in raw JS. Real work, worth
its own decision, not smuggled into phase 1.

---

## Open questions for @staynjokede

1. **Where does the ambassador's own screen live, and can a v1 user reach it?**
   Live users are on v1 — the v2 cookie is written only by the developer toggle.
   A v2-only route linked from the welcome email 404s for every real ambassador.
   Build it reachable from v1 too, or hold the links until cutover?
2. **The share promise** (phase 3): remove the words, or move the button?
3. Order. My recommendation: **1 now**, 3 as soon as you answer, 2 when the
   shapes settle, 4 last.

## On the estimates

Sized in human days out of habit. Tonight: four items quoted at a day and a half
took 1 hour 10, and the two above quoted at 2¼ hours took 44 minutes. Treat every
number here as an upper bound and expect the real one after each phase.
