# Backend requests — statutes and radar (July 31, 2026)

Six requests. Each one says what the frontend needs. How to build it is your
call.

## 1. Let statute pages be read without a login token (for Google)

Today, every statute API call fails without a login token. Google's crawler
has no token. So Google sees a generic page instead of the statute.

We ask for two things:
- `GET /statutes/{slug}` should work without a token. We only need the basic
  fields: title, short title, country, year, status, and a short description.
- A simple list of all statutes (slug + last update date) that works without
  a token. We use it to build the sitemap file for Google.

The full statute text can stay behind login. We only need the summary data.

## 2. A country list with statute counts

The statute library shows one tab per country. The endpoint
`GET /statutes/countries` does not exist today (it returns 404). We use a
hard-coded country list instead, and we hide the counts because we cannot
trust them.

Please send us, for each country: id, name, code, slug, and how many statutes
it has. Also the total count. Any response shape is fine — we adapt.

## 3. The statute outline endpoint, and one question

- `GET /statutes/{slug}/outline` returns 404 today. That is fine for now. We
  build the outline in the browser from the full XML. When the endpoint
  ships, we switch to it. Small change on our side.
- One question: `export-akn` gave us the FULL document in our tests (275 KB
  for one act, 881 KB for the 1999 Constitution). Will it stay uncapped? If
  you plan to add a size cap, please tell us first. Our reader depends on
  getting the whole document in one response.

## 4. Bad characters and one bad record in the statute data

- The statute XML has broken characters. Dashes and quotes arrive as `�`.
  Example: courts-act-1993. We show the text as-is, so users see the `�`.
- Statute id 1329 has its two title fields swapped. The title says
  "N.R.C.D. 64". The short title says "Council for Law Reporting Act, 1972".
  It should be the other way around.
- Small note: `long_title` is very often an exact copy of `preamble`. We
  handle it on our side. Just letting you know.

## 5. Preview images for statute links

When someone shares a case link, the link shows a preview card with an image.
Statute links show only text today. We can build the image ourselves once
request 1 ships (we need public data for it). Or you can serve an image.
Either way works — tell us which you prefer.

## 6. Reminder: cap report principles for guests (cases)

Guests should get at most 2 report principles in the case data, enforced on
your side. We agreed on this earlier. It is still open. Nothing changes on
our side when it ships.
