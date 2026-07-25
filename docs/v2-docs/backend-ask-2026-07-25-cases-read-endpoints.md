# Cases — the endpoints the new reader uses, and four questions

**We have rebuilt the case library, the case page and the full judgment on v2.** Below is a
list of exactly which endpoints we call and when, so you can tell us where our use is
wrong, and four questions where your answer changes what we build next.

**One thing is already blocked.** We tested prod on July 25:

| call, with no login | answer |
|---|---|
| `GET /api/cases?page=1&per_page=2` | **401** Unauthenticated |
| `GET /api/trending/cases?per_page=2` | **401** Unauthenticated |
| `GET /api/cases/{unknown-slug}` | **404** — so this one is *not* behind the login wall |

Because the list needs a login, **we cannot list a single case in `sitemap.xml`.** We built
the sitemap entries; they ship empty. That is Question 3, and it is the one with a concrete
deliverable attached.

---

## 1. The endpoints we call

### `GET /api/cases`

The library list. One request per page, 15 per page, infinite scroll.

| we send | when |
|---|---|
| `page`, `per_page` | always |
| `search` | the reader types in the search box |
| `tags` | the reader opens a tag |

We do **not** send `court_id`, `country_id` or `year`. Those filters exist in the API and
have no control in the new design yet.

We read from each row: `id`, `slug`, `title`, `display_title`, `citation`, `principles`,
`excerpt`, `court.name`, `country.abbreviation`, `country.code`, `judgment_date`,
`views_count`, `is_bookmarked`, `tags`, and `pagination.current_page` / `last_page`.

### `GET /api/cases/{slug}`

The case itself. We call it in **three different shapes**, and each shape is a separate
request:

| where | what we ask for |
|---|---|
| a case link inside a chat, when the reader hovers it | no `include_*` at all |
| the case page | `include_similar_cases`, `include_cited_cases`, `include_cited_by` |
| the full judgment page | `include_full_report` |

We also send `q=<search terms>` on the case page when the reader arrived from a search,
because we understood that to be read attribution. Tell us if it is not, and we will stop
sending it.

We read: everything the list gives us, plus `body`, `judges`, `topic`, `has_full_report`,
`full_report.full_text`, `full_report.updated_at`, `similar_cases`, `cited_cases`
(including `raw` and `treatment`), `cited_by`, `limit_exceeded`, `limit_message`, `meta`,
`bookmarks_count`.

### `GET /api/cases/{slug}` again — with no login

Once more, for the link preview. When a case link is pasted into WhatsApp or posted on X,
we build the preview card from this. That call carries **no token**, and we hold the answer
for 5 minutes.

### `GET /api/trending/cases`

The "Trending" tab on the library. `time_range=month`, 15 per page.

### `GET /api/cases/{slug}/conversations`

The reader's own chats about this case, 5 of them, shown under the case.

### `POST /api/chat`

The "ask about this case" box. Same as any other new chat, plus
`references: [{ "type": "case", "id": "<slug>" }]`.

### `POST /api/bookmarks`

The save button. `{ "type": "case", "id": <numeric id> }`.

### `POST /api/content-requests`

"Request this case", offered when a search finds nothing.

---

## 2. Four questions

### Question 1 — does reading a case count as a view every time we ask? **(most important)**

We ask because of the numbers above. One reader, reading one case, can produce **five**
`GET /api/cases/{slug}` calls:

1. they hover the case in a chat (no includes),
2. they open the case page (three includes),
3. they open the full judgment (one include),
4. WhatsApp fetches the preview when they share it,
5. their friend's phone fetches the preview again.

If each call adds one view and takes one unit from the monthly plan limit, then our reader
just spent three of their own views on one case, and the share added two more views that
belong to nobody.

**What we need to know:** is a view recorded per request, per reader per case, or per
reader per case per day? And does the plan limit count the same way?

If it is per request, tell us and we will change the client: one request per case per page
view, and the preview call moves behind something that does not count.

### Question 2 — is `GET /api/cases/{slug}` **meant** to be readable without a token?

The link preview depends on it. A crawler and a stranger have no account, so if that call
ever starts needing a login, every shared case link will show the plain Lawexa card instead
of the case.

Our test says it is open today: with no token, an unknown slug answers **404**, not 401. So
the login wall is not in front of it. We just want to know that is **intended**, so we can
rely on it. We hold each answer for 5 minutes and send no token, so nothing personal can
leak into that cache.

If it is *not* meant to be open, what we want instead is a small no-login read with just
enough to build a card: the case name, the citation, the court, the country, the date, and
one line of the holding. Nothing that is behind the plan limit.

### Question 3 — can we get a no-login list of case slugs? **(blocked today)**

This is the concrete one.

We publish one sitemap entry per case. The only way we have to enumerate cases is
`GET /api/cases` — and that needs a login, which neither a crawler nor our build has. So
the sitemap ships with 8 static URLs and **zero cases**. The code is written and it works;
it simply gets a 401 and stops.

**What would fix it:** one no-login read that returns only `slug` and a last-changed date
for every published case. No summaries, no citations, no relations. Paginated with a large
page size is fine.

We have already capped our walk at **20 pages × 100 rows = 2,000 cases**, so even once it
is unblocked, cases past that cap will be missing from the sitemap until the read is cheap
enough to raise it.

Related: the list rows carry `judgment_date` but no `updated_at`. So we currently tell
search engines that a case last changed on the day it was decided, which is wrong whenever
an editor revises it. A real `updated_at` on the list row would fix that on its own.

### Question 3b — should a signed-out visitor be able to browse cases at all?

Not really a request, more a decision we need from you.

v1 never shows the 401, because it quietly creates a **guest token** for every visitor
before it loads anything. v2 does not do that yet. So on v2 a visitor with no token now sees
"Sign in to browse cases" instead of a broken list.

Two ways to go, and it is your call which:

1. **Keep the wall.** Cases need an account. We keep the sign-in state, and Question 3's
   slug list is what makes the pages reachable for search engines.
2. **Open the list.** `GET /api/cases` becomes readable without a token, the same way
   `GET /api/cases/{slug}` appears to be. Then a signed-out reader browses, a crawler reads
   the library, and Question 3 gets easier too.

We are not asking you to change anything until you decide. We just want the answer written
down, because right now v1 and v2 behave differently for the same visitor.

### Question 4 — what is `body` and what is `full_report.full_text`?

The admin form writes both from a plain text box, so we now render both as **text**: we
split on blank lines, we mark the leading `Held:` / `Facts:` / `Per Oputa JSC:` as a
heading, and we never hand any of it to the browser as HTML.

The old v1 pages disagreed with each other about this — one rendered `body` as HTML, the
other as text — so we want your ruling rather than a guess.

**Is either field ever expected to contain HTML?** If yes, say which, and we will treat it
as HTML and clean it properly. If no, we are correct as built, and the answer is worth
recording so it does not drift again.

---

## 3. Two smaller notes

- **`cited_cases[].treatment`** is a fixed set for us today: `followed`, `applied`,
  `approved`, `considered`, `referred_to`, `distinguished`, `doubted`, `not_followed`,
  `overruled`. A value outside that set is not an error for us — we show it, title-cased,
  with no colour. So you can add to the list without breaking anything. We would just like
  to know when you do, so a new one gets the right colour.

- **`cited_cases[].cited_case_id: null`** means the citation points at a case you do not
  hold. We show those as plain text with no link. That is working correctly.

---

## What happens if we get no answer

Everything above ships and works for a signed-in reader today.

- **Question 1** is the one that can cost a reader views they paid for. Answer it first.
- **Question 3** is already blocking: no case appears in our sitemap until it is answered.
- **Question 2** is a confirmation, not a change. If the answer is "yes, it is open", we
  are done.
- **Question 3b** is a product decision. Until you make it, v1 and v2 treat a signed-out
  visitor differently.
- **Question 4** costs nothing today; it stops us getting it wrong later.
