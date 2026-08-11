# Frontend plan — ambassador referrals, and the new membership lines

Written 2026-08-11 against two docs @backendclaude published and deployed at
01:16 UTC:

- `Stay03/lawexa-api-v3` → `docs/api/ambassador-referrals.md`
- `Stay03/lawexa-api-v3` → `docs/api/spaces-channels-invite-links.md`

Every claim below about **our** code was checked against the files named in it.

---

## 0. The most important line in his doc is already done — but by accident

His doc says, twice, that the one thing that cannot be repaired afterwards is
sending `referral_code` on the **guest** call, because almost everybody is
issued a guest token before they ever sign up and attribution is written once.

**We already do it.** `lib/utils/attribution.ts` reads `?ref=` *and*
`?referral_code=`, stores the payload in `sessionStorage`, and
`lib/api/auth.ts` spreads `getStoredAttribution()` into all three calls that
matter — `register` (:17), the Google callback (:40) and `guestToken` (:50).
This shipped with the attribution work and predates the referral feature.

**But it is only correct by luck, and that is worth fixing before it bites.**

`captureAttribution()` runs in an effect inside `<AttributionBootstrap />`,
mounted in `app/layout.tsx:72`. `useGuestAuth` acquires its token in an effect
too. React runs effects **child first, then parent** — so a component deeper
than the root layout runs its effect *before* the bootstrap's. Nothing
guarantees the code is in `sessionStorage` when the guest call is built.

What saves it today is unrelated: `useGuestAuth` waits on
`isFingerprintLoading` (`lib/hooks/useGuestAuth.ts:49`), and FingerprintJS is
async, so the bootstrap always wins the race in practice. Delete that await, or
cache the fingerprint synchronously, and every referral from a first-time
visitor is silently lost with nothing to find it by.

**Fix, ~15 minutes:** call `captureAttribution()` at the top of `guestToken()`
(and `register`/Google) rather than depending on effect order. It is already
idempotent and first-touch — `attribution.ts:75` returns early if a payload
exists — so calling it again is free and the ordering hazard disappears.

This is item one. It is the cheapest thing on the list and the only one whose
failure cannot be repaired.

---

## 1. The membership lines are live and we are drawing them wrong — RIGHT NOW

Deployed 01:16. Every join, leave and removal now posts a system message into
the channel. Our feed has a contractual fallback to plain text for unknown
types (`types/collab.ts:298`), so nothing breaks — which is exactly why this is
easy to leave broken: **"Ada Obi joined the channel" is currently drawn as an
ordinary message bubble, as though Ada typed those words.**

The contract, from his doc:

| `metadata.type` | Content |
|---|---|
| `member_joined` | `Ada Obi joined the channel` |
| `member_left` | `Ada Obi left the channel` |
| `member_removed` | `Ada Obi was removed from the channel` |

- `is_ai` is `false` **and** `author` is `null`. Either test alone identifies one.
- `metadata.user_uuid` says who it is about.
- They must **not** make a channel look unread.
- `member_left` and `member_removed` stay different words. Rendering a removal
  as "left" misrepresents that person in front of everyone.

**One trap, and our code already has the rule written down.** A `null` author is
NOT Lawexa. `types/collab.ts` already says to key Lawexa on `is_ai`, never on a
missing author — that rule was written for hard-deleted humans and it now
protects these lines too. Do not let anything start reading `author === null`.

**Work:** extend `MessageType`, add a quiet centred line renderer, exclude the
three types from unread counting. **~2 hours.** This is the only item that is
visibly wrong on the live site today.

---

## 2. The ambassador's own screen — claim a code, see their numbers

```
GET  /api/ambassadors/code          403 = not an ambassador
POST /api/ambassadors/code          { code }   throttle 10/min
GET  /api/ambassadors/performance   throttle 60/min
```

**There is no ambassador role and there will not be one.** Gate on the `403`
from `GET /api/ambassadors/code`, never on a user role. This is the same shape
as the guest rule we already follow on invites: ask the server what this person
can do, do not infer it.

Screen:
- No code yet (`current: null`) → the claim form, not an error.
- Has one → show it, the share link `lawexa.com/?ref={code}`, a copy control,
  and **the retired codes**. Retired codes still work, and an ambassador who
  changed theirs needs to see that last term's printed face card still credits
  them. That is the whole promise of the face card.
- `referred_count` and `paid_count`. No names, no emails — an ambassador is not
  staff.

Errors are already written for us: `409` taken, `422` use the server's message,
`429` slow down.

**Codes are stored lowercase.** `AdaObi` saves and returns as `adaobi`. Render
what the API returned, never what was typed — the face card is printed from
this and a code that displays differently from how it resolves is a bug report
waiting to happen.

**~3/4 day.**

---

## 3. Admin financials

```
GET /api/admin/ambassadors/financials     role:admin
```

Reuses the `components/admin/observability` primitives, as the job screens do.

Three things to get right, all stated in his doc and all easy to get wrong:

- **`revenue` is a decimal STRING, 2dp, never a number.** Format it, never do
  arithmetic on it. Parsing to float throws away exactness the server computed.
- **`revenue` is what referred people spent. It is NOT commission.** Nobody has
  decided ambassadors are paid anything. The column may not be called
  "earnings" or "owed".
- **`unusual_activity`** (>20 signups in a day) is a prompt to look, not an
  accusation — a lecture-hall demo trips it exactly as farming does. Render it
  as a quiet marker, never a warning or a block.
- Ambassadors who referred nobody appear with zeros. Do not filter them out:
  "did nothing" and "not in the list" are different answers.

**~1 day.**

---

## 4. The link itself — nothing to build

`lawexa.com/?ref=adalaw` already works end to end once §0 is done. A code that
matches nothing is stored and credits nobody; it never fails a signup, so there
is **no client-side validation to write**.

---

## Order, and why

1. **§0**, 15 minutes. Cannot be repaired if it goes wrong.
2. **§1**, 2 hours. Wrong on the live site right now.
3. **§2**, 3/4 day. The thing ambassadors actually asked for.
4. **§3**, 1 day. Needs §2's shape settled first.

**Total ≈ 2 days.** Treat that the way @backendclaude asked his own numbers to
be treated tonight: it is sized in human days out of habit, and the last four
things I estimated at a day and a half took 1 hour 10. I will report the real
time after each piece.

## What I need from @staynjokede

1. Approve the order, or change it.
2. §1 is live and wrong now — say if it should ship on its own, ahead of
   everything else.
