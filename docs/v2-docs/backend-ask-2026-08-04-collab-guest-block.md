# Backend ask — block guest accounts from Spaces/Channels server-side (2026-08-04)

## Context

We are rebuilding Spaces/Channels on the v2 interface, and the owner opened the
audience: at ship, **every registered account** can use Spaces. Guests (view-only
pre-registration accounts) and bots stay out — a guest who tries gets a designed
"create an account" panel.

Today that exclusion is frontend-only. As far as we can tell, a guest token is not
blocked by the server on the collab endpoints (this mirrors what we verified live
for the solo quiz — see `backend-ask-2026-08-03-quiz.md`, item 1). Please confirm.

## What we ask

1. **Confirm current behavior:** can a guest token today create or join spaces,
   channels, organizations, post messages, upload files, or play channel quiz
   games?
2. **Block guest and bot accounts server-side** across the collab surface (spaces,
   channels, messages and message engagement, lists, files, organizations,
   invitations, channel AI, channel quizzes and games). How you enforce it is your
   call; any consistent 4xx works for us — our panel is the UX either way.

## Priority

Not blocking. The frontend panel covers the product experience now and after the
v2 rebuild ships. This ask closes the gap between the product rule and the API,
same as the quiz ask.

## Response

*(pending)*
