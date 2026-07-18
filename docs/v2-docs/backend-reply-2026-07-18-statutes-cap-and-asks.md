# Reply to backend — statute node cap + recently-viewed (Ask A) + channels (Ask B)

July 18, 2026. Answers numbered to match their eight questions. Statute answers were
traced against the LIVE code path (`app/(main)/statutes/[slug]` → `export-akn`) before
sending — an earlier draft wrongly described the deprecated `/nodes` path as live.

---

## Statutes

**1.** Our LIVE statute reader doesn't call `/statutes/{slug}/nodes` at all. Opening a
statute makes one request: `GET /statutes/{slug}/export-akn` — the full statute as
AKN 3.0 XML — which we parse and render client-side as a single document. The only
`/nodes` consumer is our deprecated `statutes-old` route (it full-fetches
`from=0&to=nodes_count-1`); that route is scheduled for deletion, so cap-breaking it is
acceptable — we'll delete it first.

The question back: does your 100-node cap touch only `/nodes`, or is `export-akn` also
being capped/retired? If the intent is to end full-document fetches generally, we're
aligned — outline + ranged node hydration is exactly the flow we want for our redesigned
reader. Give us the target release date and whether `export-akn` keeps working meanwhile,
and we'll time our switch with you.

**2.** There is NO table of contents in the current reader — it renders the whole
document linearly from the XML. So `GET /statutes/{slug}/outline` doesn't replace an
existing TOC build; it ENABLES the one we want to add, plus on-scroll range hydration to
replace the full-document fetch. The outline fields you listed (type, number, title,
slug_path, position, depth) are sufficient. Nice-to-have only if free: a stable node id
alongside slug_path for keys/anchors.

**3.** List cards render `description`, falling back to `preamble` when description is
null — dropping preamble from rows means no-description statutes lose their preview
line. Fine with description-only if coverage is decent; otherwise keep some short
preview field on rows. Either way, keep preamble on the DETAIL payload — the reader
renders it there.

## Recently viewed (Ask A)

**4.** Confirmed: each item once, stamped with its latest view time — and ONE merged
interleaved list (cases + notes + statutes, newest first). That's the shape we render.

**5.** `{ type, viewed_at, item }` with the existing list payloads is exactly right —
nothing missing for our cards.

**6.** Acknowledged on statute view history starting from deploy day — fine.

## Channels (Ask B)

**7.** Yes to the preview: author display name + a short plaintext snippet (markdown and
mentions flattened, ~120 chars is plenty; null when the last message was deleted).
AI-authored messages need nothing special — the author name suffices.

**8.** Agreed with your recommendation: pure `last_message_at` desc — the badges already
convey unread, and unread-first would make the module reorder jumpily. Muted channels:
exclude, except when the channel carries `mention_count > 0` (mute kills activity, never
a direct @you). If that exception is awkward server-side, plain exclusion is fine and
muted @yous still surface via the space rollups.
