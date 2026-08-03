# Backend request — view counter for statutes (Aug 2, 2026)

One question and one request.

**The question:** do statutes have a view counter on your side today? Cases
and radar scan reports have one; the statute payload does not show one, so we
believe statutes have none. Please confirm.

**The request:** we want statute views counted. What we would consume:
- A views count on the statute payload, so we can show it where it helps.
- Counting should reflect real readers opening a statute — not Google's
  robot. (The robot only ever reads the public summary, never the statute
  endpoints a signed-in reader calls, so this should come naturally.)

How you count, store, and dedupe is your call. Nothing on our side blocks
this; we render the number whenever it arrives.
