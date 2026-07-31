# Backend asks — statutes + radar wave (July 31, 2026)

> One message, six items. Items 1–5 came out of building the v2 statute library,
> the v2 statute reader, and the v2 radar screens. Item 6 is a standing reminder.
> Each item states what the frontend consumes — how to build it is your call.

## 1. Public statute reads (SEO)

Today every statute endpoint answers 401 without a bearer token (measured
July 31: list, show, export-akn). So crawlers and signed-out visitors get a
generic card for `/statutes/{slug}`, and the sitemap cannot list statutes.

What we consume:
- `GET /statutes/{slug}` readable WITHOUT a token (title, country, year,
  status, short_title, description/long_title — enough for a metadata card).
- A slug index readable without a token (slug + updated_at per statute), for
  the sitemap. Same shape as the cases sitemap ask from July 25.

The reader itself can stay auth-walled. We only need the metadata read.

## 2. Country facets for the statute library

The v2 library shows country tabs. Today they run on a seed list because
`GET /statutes/countries` is 404. We show NO counts while the data is seeded —
counts appear the day the endpoint ships.

What we consume: per country — id, name, code, slug, and statute count; plus
the total. Any envelope works; we adapt on our side.

## 3. Statute outline endpoint + export-akn cap question

The v2 reader derives the outline (parts/chapters/sections + eIds) on the
client from the full AKN export. That works. When `GET /statutes/{slug}/outline`
ships, we swap one function and drop the client derivation.

Also, please confirm: `export-akn` returned the FULL document uncapped in our
measurements (275 KB for Courts Act 1993, 881 KB for CFRN 1999). Is it going to
stay uncapped? If a cap is planned, tell us before it lands — the reader's
loading strategy depends on getting the whole document in one response.

## 4. Statute data quality (found while rendering real documents)

- The AKN XML text contains mojibake: em-dashes and quotes arrive as `�`
  (example: courts-act-1993). We render text verbatim, so the � is visible.
- Statute id 1329 has title and short_title swapped: title is "N.R.C.D. 64",
  short_title is "Council for Law Reporting Act, 1972".
- `long_title` very often duplicates `preamble` exactly. Not breaking — we
  dedupe — but worth knowing.

## 5. OG images for statutes

Case pages ship real OG cards. Statutes ship text-only cards because there is
no statute OG image source. If you can serve one (or want us to build an
`/api/og/statutes` route against public data from item 1), statute links in
chats and social get real previews.

## 6. Standing reminder — guest principles cap (cases)

Guests should get at most 2 report principles SERVER-side on the case
enrichment payload. The frontend needs no change when this ships — it renders
whatever arrives. This was agreed earlier and is still open.
