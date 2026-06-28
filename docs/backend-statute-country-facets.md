# Request: statute country facets endpoint

## What the frontend needs

The statute library is getting a country tab bar — an **All** tab (default) plus one
tab per country that has statutes, each with a flag and a count:

```
[ 🌍 All 1005 ] [ 🇳🇬 Nigeria 787 ] [ 🇬🇭 Ghana 150 ] [ 🇹🇿 Tanzania 52 ] [ 🇺🇬 Uganda 15 ]
```

The existing `GET /api/statutes?country={id}` filter already powers the per-tab
filtering, and each statute already carries its `country` object, so the **only**
thing missing is a way to know **which countries actually have statutes, and how
many**. We don't want to build tabs from the full country list (`GET /api/countries`)
because most countries have zero statutes and would render as empty tabs.

This is exactly the aggregation already verified in the database:

| country_id | count |
| ---------- | ----- |
| NULL       | 1     |
| 1 (Nigeria)| 787   |
| 2 (Ghana)  | 150   |
| 22 (Tanzania) | 52 |
| 23 (Uganda)| 15    |

## The contract we'll consume

`GET /api/statutes/countries`

(If a static segment under `/statutes` risks colliding with `/statutes/{slug}`,
`GET /api/statutes/facets` or `GET /api/statute-countries` is equally fine — we only
depend on the response shape below, not the path.)

Response:

```json
{
  "success": true,
  "message": "Statute country facets retrieved successfully",
  "data": {
    "total": 1005,
    "countries": [
      {
        "country": {
          "id": 1,
          "name": "Nigeria",
          "slug": "nigeria",
          "code": "NG",
          "abbreviation": "NG"
        },
        "statute_count": 787
      },
      {
        "country": {
          "id": 2,
          "name": "Ghana",
          "slug": "ghana",
          "code": "GH",
          "abbreviation": "GH"
        },
        "statute_count": 150
      },
      {
        "country": {
          "id": 22,
          "name": "Tanzania",
          "slug": "tanzania",
          "code": "TZ",
          "abbreviation": "TZ"
        },
        "statute_count": 52
      },
      {
        "country": {
          "id": 23,
          "name": "Uganda",
          "slug": "uganda",
          "code": "UG",
          "abbreviation": "UG"
        },
        "statute_count": 15
      }
    ]
  }
}
```

Field notes:

- `data.total` — total number of statutes across **all** countries, **including**
  statutes whose `country_id` is `NULL`. This is the count shown on the **All** tab
  (so here `787 + 150 + 52 + 15 + 1 = 1005`).
- `data.countries[]` — one entry **only** for countries that have at least one
  statute. Countries with zero statutes must be omitted. The `country` object is the
  same shape already embedded in statute responses. Ordering is not significant — the
  frontend will display them as returned (a count-desc or name-asc order is fine).
- The `NULL`-country statutes have no tab of their own; they only appear under **All**.
  They do **not** need their own entry in `countries[]`.

## Why we're asking for this specifically

We only need the contract above — not a particular caching, indexing, or auth
approach. Until this ships, the frontend renders the tabs from a small static seed
that mirrors the table above, and switches to this endpoint automatically once it's
live (see `lib/hooks/useStatutes.ts` → `useStatuteCountries`).
