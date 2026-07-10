# Backend question — case create/update write contract

Context: we've consumed the read-side changes from
`case-structures-and-enrichment.md` (cited_cases edges, treatment, removed
`judicial_precedent`, etc.). Before we touch the admin **write** path we need to
confirm the write contract, because the doc's section 2 shows keys that differ
from what our admin form currently sends.

## What our admin form sends today (`POST /api/cases`, `PUT /api/cases/{id}`)

```json
{
  "judge_ids": [12, 13],
  "similar_case_ids": [101, 102],
  "cited_case_ids": [201, 202]
}
```

## What the doc documents

```json
{
  "judges": [{ "judge_id": 12, "role": "lead" }],
  "citations": [{ "cited_case_id": 212, "treatment": "approved" },
                { "cited_case_raw": "A v B [2001] 1 NWLR 1", "treatment": "referred_to" }]
}
```

## Questions

1. **Are the legacy keys still accepted as aliases?** Specifically, do
   `judge_ids` and `cited_case_ids` still work on create/update, or have they
   been removed in favour of `judges[]` / `citations[]`? (If removed, our
   current admin save silently drops judges and cited cases — we need to
   migrate before that ships to admins.)
2. **`similar_case_ids`** is not mentioned in section 2. Is it unchanged and
   still the way to write similar cases, or did it also move to an object form?
3. **Full-replace semantics** — confirmed for the new collections. Does the same
   apply to `similar_case_ids` (omit = leave untouched, `[]` = clear)?
4. **Reading back for the edit form.** The admin edit screen fetches
   `GET /api/cases/{slug}` with **no include flags**, so it currently receives
   no `cited_cases` / `similar_cases` / `cited_by`. To repopulate the edit form
   we'd need those. Should the admin edit fetch pass
   `?include_cited_cases=true&include_similar_cases=true`, or is there an
   admin-oriented shape that returns the writable relations by default?

Once (1)–(4) are answered we'll migrate the form to the object-based contract
(unlocking judge roles, citation treatments, and the new structured
collections) in one pass.
