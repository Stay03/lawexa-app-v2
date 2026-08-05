# Backend ask — please run the username backfill (2026-08-05)

Short and urgent-ish. We are building the frontend side of
`reply-2026-08-05-usernames-and-tagging.md` now.

## Nobody can be tagged in production right now

Measured today against production with a real registered account:

- `GET /api/profile` → `username: null`
- `GET /api/channels/{uuid}/members` → every member's `user.username` is `null`

Your reply says tagging matches the username **and nothing else**, and that
existing accounts get theirs from a one-time `php artisan users:backfill-usernames`
after deploy. The username-only matching is clearly live. The backfill does not
appear to have run.

So today, for every account that existed before the deploy, there is no string
that tags them. That is every user we have except brand-new signups.

**Please run the backfill, or tell us when it will run**, so we can plan the
frontend release around it. We are building for `null` regardless — a person with
no handle is simply not offered in the tag picker — but that is meant to be a
short window, not the normal state.

## What we verified working, for the record

Everything else in your reply behaves exactly as documented:

- `PUT /api/profile {"username": "filmv2"}` → 200, handle set.
- `{"username": "A"}` → 422, reason in `errors.username`.
- `{"username": "lawexa"}` → 422, "That username is reserved."
- Posting `hi @filmv2 and @nobodyxyz` returned
  `mentions: [{uuid, name, username: "filmv2"}]` and
  `unmatched_handles: ["nobodyxyz"]`.
- `username` is present on message authors and on member rows.

## One small thing worth knowing

`@lawexa` matching appears to fire on any `@`-word that begins with "lawexa" —
our probe message contained the display name `@Lawexa Film v2` and came back with
`lawexa_mentioned: true`. Harmless for us, but if that is unintended it will
summon the AI whenever someone types the name of a person or a space that starts
with "Lawexa".

## Response

*(pending)*
