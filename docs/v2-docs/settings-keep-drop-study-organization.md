# Organization — the v1 keep / redesign / drop study

Written 2026-09-19, before any code, per the standing rule (README "Phase workflow"
item 3). Sources: first-hand read of v1's `components/collab/OrganizationHome.tsx`
(338 lines) and v2's `v2/features/organizations/` (9 files), the live
`/api/my-organization` and `/api/spaces` payloads, and
[`phases/phase-5-collab-notifications/redesign-brief.md`](phases/phase-5-collab-notifications/redesign-brief.md)
§`/organization`.

Verdict vocabulary (house convention): **KEEP** (port behaviour as-is, restyle only) ·
**KEEP the model, REDESIGN** (the idea survives, the screen is rebuilt) · **FIX**
(v1 defect, correct in the rebuild) · **DROP** (dies, not rebuilt) · **BUILD NEW**
(no v1 counterpart) · **FOLD IN** (absorbed into another surface) · **DEFER** (later
wave).

---

## ⚠ POPULATED STATE UNSEEN

**Every verdict below is read off the code and the API, not off a rendered
organization.** The account available to this study is in no organization:

    GET /api/my-organization -> 200  "You are not a member of any organization."

so both films of `/organization` show the empty state and nothing else. Creating a
test organization was considered and declined: the row would appear in
`/api/organizations` where real users can see it, and it would sit there until
somebody remembered to remove it.

§6 lists the questions this study therefore **cannot** answer. They are named rather
than guessed at. Do not read a verdict in §3 or §4 as covering layout at 412px.

---

## §0 — Where the screen is, and why that is an open question

`/settings/organization` in v2 is a redirect to `/organization`, on **owner decision
D7**: "v2 has no settings surface; an org is a thing you visit, not a preference"
(`phases/phase-5-collab-notifications/v1-keep-drop-study.md` D7).

**That reason expired on 2026-09-19**, when the v2 Profile screen shipped into
`/v2/settings/profile`. v2 now has a settings surface. Meanwhile the owner's own
settings list puts Organization as the second row under YOUR ACCOUNT.

Both positions are his. **This study does not pick between them**, and the decision
is not ours to make. What is recorded here is that the premise moved, which is a
different thing from disagreeing with the judgement.

Five places state the expired premise as current fact:

| file | line |
| --- | --- |
| `docs/v2-docs/phases/phase-5-collab-notifications/v1-keep-drop-study.md` | 173 |
| `docs/v2-docs/phases/phase-5-collab-notifications/v1-keep-drop-study.md` | 264 |
| `app/v2/organization/layout.tsx` | 9 |
| `app/v2/settings/organization/page.tsx` | 4 |
| `v2/features/organizations/OrganizationScreen.tsx` | 58 |

None of them changes behaviour. All of them will be read as current by the next
person. They are left untouched while the decision is open, and annotating them is
a named next action rather than something done quietly here.

---

## §1 — API facts that shape the design (verified 2026-09-19 against production)

1. `GET /api/my-organization` answers **200 with `data: null`** when the caller is in
   no organization. That is a real answer, not an error, which is why the screen has
   four states rather than three.
2. The organization payload carries **no `my_role`**. Governance is read from the
   member roster, fetched alongside.
3. `verification_requested_at` is **admin-only** and is stripped from a normal
   caller's copy. A member who has just submitted documents therefore cannot see an
   "under review" panel from the payload alone.
4. **A space row carries its `organization`.** Live keys on `/api/spaces`:
   `uuid, name, description, type, type_label, is_private, settings, organization,
   active_members_count, unread_channels_count, mention_count, my_role, created_at,
   updated_at`.
5. **`/api/spaces` returns the spaces the VIEWER is in, not the spaces an
   organization owns.** See §5, because the redesign brief's spaces block depends on
   this and the difference is not cosmetic.
6. `logo_url` exists on the payload and the API has upload and delete routes. The app
   configures **no `images.remotePatterns` at all**, so `next/image` refuses any
   remote logo URL today.

---

## §2 — What v1 is, in one paragraph

One file, `components/collab/OrganizationHome.tsx`, 338 lines, mounted at
`/settings/organization` through a 5-line page. It renders a loading skeleton, an
error state, an empty state, or an identity header (glyph tile, name, type badge,
Verified badge, a meta row of email / Website / city+country, description) with a
Members button and an admin `…` menu, then one verification section with three
shapes, then four overlays: members sheet, form dialog, verification dialog, delete
alert. Everything else about an organization lives somewhere else in the app.

---

## §3 — Screen by screen

| Thing | Verdict | Note |
| --- | --- | --- |
| Four answers: pending / error / `data: null` / organization | **KEEP** | v2 already has it, and treats `data: null` as a designed panel rather than an empty state. Correct. |
| Identity header (name, type, verified, email, website, place, description) | **KEEP the model, REDESIGN** | The facts are right. The arrangement is a settings block, and the brief's `PlaceHeader` + `OrgCrest` is the direction. |
| Generic `Building2` glyph tile | **KEEP for now** | The logo is deliberately unrendered: no upload affordance exists in either app, and `next/image` would refuse the remote URL. An `OrgCrest` monogram is a real improvement that needs no backend. |
| Verified badge | **KEEP, RESTYLE** | v1 is a solid `bg-emerald-600` chip; v2 is already the contrast-correct tinted chip (`emerald-700` light, `400` dark). Keep v2's. Colour source: see §4. |
| Verification section, three states | **KEEP** | Verified / under review / get verified. v2 adds a session-only "just submitted" path so the submitter sees the under-review panel that fact 3 above would otherwise hide from them. |
| Members behind a sheet, nothing on the page | **REDESIGN** | The roster is already fetched for governance. A People block on the page costs no request. |
| Spaces owned by the organization | **BUILD NEW** | No v1 counterpart. See §5 before building it. |
| `…` menu: Edit, Delete | **KEEP** | Placement is right for actions this rare. |
| Delete confirmation naming the orphan behaviour | **KEEP** | "Spaces it owns are not deleted, but they lose their organization." That sentence is earned correctness; do not shorten it. |
| Delete dialog kept OUT of the URL while the other four overlays are in it | **KEEP** | A link that re-arms "Delete this organization?" on every refresh is an armed trigger. |
| v1: every overlay in local state, so Back does not close them and a refresh loses them | **FIX — already fixed in v2** | Four overlays ride one `?panel=` key, with `canOpen` gating so a copied `?panel=edit` cannot hand a plain member the admin form. |
| v1: delete success and failure land in a toast | **FIX — already fixed in v2** | v2 holds the server's own sentence inline in the dialog. |
| v1: role read only from the payload's embedded members | **FIX — already fixed in v2** | v2 fetches the roster and degrades to "no manage actions" rather than to a button that 403s. |
| Empty-state copy | **KEEP v2's** | v2 explains what an organization is for and names where an invitation arrives. v1's is one line. |

---

## §4 — The emerald, and why it is not this screen's job

The redesign brief says: "Make the emerald a real `--success` token rather than two
hardcoded emerald usages in unrelated features."

**Counted 2026-09-19, that is wrong by an order of magnitude:**

    this feature's own          3    OrganizationScreen 1, VerificationPanel 2
    across v2, in class strings  34   in 19 files
    v1 component files           37   more
    `--success` in globals.css   does not exist

It is also not a find-and-replace. `GamePhases.tsx` already records the reasoning:
`emerald-600` on a tinted chip falls under 4.5 : 1, so light text uses `emerald-700`
while dark stays on 400. Its own comment calls the sweep "a phase-6 token job, not
this wave's".

**Verdict: DEFER.** Changing three sites here leaves 31 inconsistent; changing all 34
turns one screen's rebuild into a fleet-wide colour migration. The Organization
rebuild uses whatever the sweep lands on, and keeps v2's contrast-correct chip until
then.

---

## §5 — The spaces block under-reports, and the screen would not say so

The brief proposes "**Spaces owned by this organization** (reusing the spaces lane,
filtered from cache — no new endpoint)".

The filter is real: fact 4 above confirms a space row carries its `organization`.

The problem is the source. `/api/spaces` returns **the spaces the viewer is in**. An
owner probably sees all of theirs. A plain member of an organization that owns nine
spaces, who belongs to two of them, would read "Spaces owned by this organization: 2"
as a fact about the organization, and no line on the screen says whose view it is.

Two honest ways out:

1. An endpoint that lists an organization's spaces. That is a backend ask, and one is
   not worth raising while §0 is open: a screen that may move is not a screen to
   request an API for.
2. Copy that says **"Spaces you can see"**, and a count that never claims to be the
   total.

Option 2 ships today and is honest. Option 1 is better and costs a round trip with
backend. **This is a product call, and it goes with the §0 question rather than
ahead of it.**

---

## §6 — What this study cannot answer without a populated screen

Named rather than guessed. Each needs one film of a real organization at 412px.

1. **Does the identity header survive a long name?** The `h1` truncates, but it sits
   in a `flex-wrap` row with a type badge and a Verified badge. Whether a long name
   truncates beside its badges or pushes them to a second line is unknown.
2. **Does the meta row collapse legibly on a phone?** Email, Website and place share
   one `flex-wrap` row with `gap-x-4`. A long organization email may take the whole
   width and put the other two on separate lines.
3. **Do the Members button and the `…` menu stay on the name's line at 412px**, or
   orphan under it the way the invitation card's buttons do?
4. **What do the three verification states actually look like** against the v2 sheet
   and the corrected primary.
5. **Does a description of realistic length read**, or does it need clamping?

None of the five is answerable from the code. Answering them needs either a real
organization the study can view, or the owner's word that a test one may be created.
