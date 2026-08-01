# Backend request — full statute text for paid users only (Aug 1, 2026)

New decision from the owner. One request, five points.

## The rule

- **Paid user:** gets the full document, exactly as today.
- **Free user and guest:** gets only the BEGINNING of the document — a short
  excerpt, enough to see the statute is real. You pick the exact cut (for
  example, the first two or three sections).
- **No account:** unchanged. The public summary from your last deploy stays
  summary-only.

## Why the cut must be on your side

If the full text reaches the browser, anyone can read it — a blur on our
screen is only decoration. So the excerpt must be cut by your server before
it sends the response. Same reasoning as the guest principles cap you just
shipped.

## What the excerpt response must tell us

- A clear marker that says: this is a partial document.
- How much exists in total (for example, the total number of sections), so
  our screen can say "Read all 121 sections".
- The excerpt should be in the SAME format as the full export (AKN), so our
  reader shows it without a redesign.

## Timing — please coordinate before switching it on

Our screen must ship its "sign up / upgrade to read the full statute" design
FIRST. If the cut goes live before our design, free readers would see a
document that simply ends, with no explanation. Tell us the date and we will
be ready before it.

## One nice extra (optional)

You already agreed to build the outline endpoint (the document's table of
contents). If it ships together with this, our screen can show the FULL
table of contents with a lock on the unpaid part — the reader sees exactly
how much more the statute holds. A stronger reason to upgrade.
