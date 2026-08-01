# Backend requests — statutes and radar (July 31, 2026)

Five requests. Each one says what the frontend needs. How to build it is your
call.

## 1. Let statute SUMMARY data be read without a login token (for Google)

To be clear: this does NOT open the full statute text to the public. The full
text stays behind login, exactly as today.

The problem: every statute API call fails without a login token. Google's
crawler has no token. So Google sees a generic page instead of the statute's
name and description.

We ask for two things:
- `GET /statutes/{slug}` should work without a token, returning ONLY the
  summary fields: title, short title, country, year, status, and a short
  description. Not the document text.
- A simple list of all statutes (slug + last update date) that works without
  a token. We use it to build the sitemap file for Google.

## 2. Statute text: keep the full export, and plan an AKN piece-by-piece read

Today the reader gets the full document from
`GET /statutes/{slug}/export-akn` in one response (measured: 275 KB for one
act, 881 KB for the 1999 Constitution). Two things:

**a) Please keep `export-akn` uncapped.** If you plan to add a size cap, tell
us first — the reader depends on getting the whole document in one response.

**b) For the future piece-by-piece read, we want it AKN-based — NOT the
`/nodes` endpoint.** `/nodes` returns flattened records and loses the AKN
structure our reader is built on. What we would consume instead:

- An outline call: the document's skeleton — every part, chapter, and
  section with its `eId`, its number, and its heading, in document order.
  No body text. Small and fast.
- A fragment call: given one `eId`, return that element's complete AKN XML
  subtree — exactly the same XML that element has inside the full export.

The one hard rule: the `eId`s must be the SAME ones the full export carries.
They are our anchors — deep links, the contents list, and scroll tracking
all key on them. If outline + fragments carry the same `eId`s, our existing
reader consumes fragments with no redesign.

No urgency: the full export works today. This is the agreed direction for
when documents outgrow one file.

## 3. Bad characters and one bad record in the statute data

- The statute XML has broken characters. Dashes and quotes arrive as `�`.
  Example: courts-act-1993. We show the text as-is, so users see the `�`.
- Statute id 1329 has its two title fields swapped. The title says
  "N.R.C.D. 64". The short title says "Council for Law Reporting Act, 1972".
  It should be the other way around.
- Small note: `long_title` is very often an exact copy of `preamble`. We
  handle it on our side. Just letting you know.

## 4. Preview images for statute links

When someone shares a case link, the link shows a preview card with an image.
Statute links show only text today. We can build the image ourselves once
request 1 ships (we need public data for it). Or you can serve an image.
Either way works — tell us which you prefer.

## 5. Cap report principles for guests (cases)

Guests should get at most 2 report principles in the case data, enforced on
your side. We agreed on this earlier. It is still open. Nothing changes on
our side when it ships.
