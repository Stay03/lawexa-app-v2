# Backend ask — let org governors see "verification under review" (2026-08-04)

## Context

The v2 organization page shows three verification states: verified, under review,
and get-verified. "Under review" is derived from `verification_requested_at` on the
organization payload — but that field is documented as **platform-admins only**.

So the person who submits the CAC document can never see "under review" from the
server: after a reload (or on another device) the panel falls back to "Get
verified" with an active request button, inviting a duplicate submission. The v2
UI papers over this within one session (an optimistic submitted state), but the
truth does not survive a reload.

## What we ask

Expose whether a verification request is pending to the organization's own
owner/admin — either by stamping `verification_requested_at` for governors, or any
equivalent field (for example a boolean `verification_pending`). Shape is your
call; we render "under review" from it.

## Priority

Low. The optimistic state covers the common flow; this closes the reload gap and
prevents duplicate CAC submissions.

## Response

*(pending)*
