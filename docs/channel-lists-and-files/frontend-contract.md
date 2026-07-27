# Channel Lists & Files — Frontend Contract

> The API surface for **task lists** and the **file library** inside a channel. Companion to the channels realtime contract (`docs/channels/phases/phase-1-foundations/frontend-contract.md`). Everything here lives inside an existing channel and rides the existing `channels.{uuid}` presence socket.

## 1. Conventions

- **Auth**: every route is `auth:sanctum` — send `Authorization: Bearer <token>` and `Accept: application/json`.
- **Identifiers**: task lists and items are addressed by **`uuid`**. Files are addressed by their integer **`id`**. Channels by `uuid` (as elsewhere).
- **Success envelope**:
  ```json
  { "success": true, "message": "…", "data": … }
  ```
- **Paginated envelope** (list endpoints):
  ```json
  {
    "success": true, "message": "…", "data": [ … ],
    "pagination": { "current_page": 1, "per_page": 15, "total": 2, "last_page": 1, "from": 1, "to": 2 },
    "links": { "first": "…", "last": "…", "prev": null, "next": null }
  }
  ```
- **Error envelope**: `{ "success": false, "message": "…", "errors": { field: [msgs] } | null }`.
- **Status codes**: `200` ok · `201` created · `401` no/invalid token · `403` not allowed (e.g. not a member) · `404` not found (also used for foreign-parent mismatches — see below) · `422` validation · `429` throttled.
- **Privacy rule (important)**: task lists and files are **channel content**. Reading them requires being an **active member of the channel**. Space owners/admins and platform admins are **denied read** (they get `403`) — same as channel messages. They can still *delete* for moderation (see permission tables).

---

## 2. Task lists

### List the channel's lists
`GET /api/channels/{channelUuid}/lists?per_page=15`
Paginated. Each list object here carries **counts, not the items array**:
```json
{
  "uuid": "7c7b24d8-…",
  "channel_uuid": "81b089c1-…",
  "title": "Sprint Plan",
  "description": "…",
  "is_ai": false,
  "creator": { "uuid": "…", "name": "Owner User", "avatar_url": null },
  "items_count": 3,
  "checked_count": 1,
  "settings": null,
  "created_at": "2026-07-13T20:49:41+00:00",
  "updated_at": "2026-07-13T20:49:41+00:00"
}
```

### Create a list (optionally pre-filled)
`POST /api/channels/{channelUuid}/lists` · throttle 30/min
```json
{ "title": "Sprint Plan", "description": "optional", "items": [ { "content": "Draft motion" }, { "content": "File brief" } ] }
```
→ `201` with the full list object **including `items`** (positions assigned `0..n-1`).

### Show one list (with items)
`GET /api/lists/{listUuid}` → the list object **with the `items` array** (no counts):
```json
{
  "uuid": "7c7b24d8-…", "channel_uuid": "81b089c1-…",
  "title": "Sprint Plan", "description": "…", "is_ai": false,
  "creator": { "uuid": "…", "name": "…", "avatar_url": null },
  "items": [ /* Item objects, ordered by position */ ],
  "settings": null,
  "created_at": "…", "updated_at": "…"
}
```

### Rename / edit a list
`PUT /api/lists/{listUuid}` — body `{ "title"?: "...", "description"?: "..." }` → `200` list.
Allowed for the **list creator** or the **channel governance chain** (channel owner/admin, space owner/admin, platform admin). Others → `403`.

### Delete a list (soft delete)
`DELETE /api/lists/{listUuid}` → `200`. Same permission as rename. A deleted list (and its items) disappears from all reads.

**List object field notes**
- `is_ai: true` ⇒ created by **Lawexa** (the AI); `creator` is then `null`. Render the Lawexa identity on `is_ai`, not on `creator === null`.
- `title` ≤ 255 chars; `description` ≤ 5000. `items` on create ≤ 100 entries; each `content` ≤ 1000.

---

## 3. Task-list items

Items are **collaborative** — **any active channel member** may add / edit / check / reorder / remove items on **any** list in the channel, regardless of who created it.

### Item object
```json
{
  "uuid": "cf16cfbc-…",
  "content": "Draft motion",
  "position": 0,
  "is_checked": true,
  "checked_at": "2026-07-13T20:50:22+00:00",
  "is_ai": false,
  "creator":    { "uuid": "…", "name": "…", "avatar_url": null },
  "checked_by": { "uuid": "…", "name": "…", "avatar_url": null },
  "created_at": "…"
}
```
`checked_at` / `checked_by` are `null` when unchecked. `is_ai`/`creator`/`checked_by` follow the same Lawexa rule (`null` actor = Lawexa when `is_ai`).

### Add an item (appends to the end)
`POST /api/lists/{listUuid}/items` · throttle 60/min — body `{ "content": "…" }` → `201` item.

### Edit content / check-off
`PATCH /api/lists/{listUuid}/items/{itemUuid}` · throttle 60/min — body `{ "content"?: "…", "is_checked"?: true }` (at least one field; empty body → `422`). Checking stamps `checked_at`/`checked_by` = the acting user; unchecking clears them. **Position is not changed here** — use reorder.

### Remove an item (soft delete)
`DELETE /api/lists/{listUuid}/items/{itemUuid}` → `200`.

### Reorder (the only way to change order)
`POST /api/lists/{listUuid}/items/reorder` · throttle 60/min
```json
{ "item_uuids": ["<uuid3>", "<uuid1>", "<uuid2>"] }
```
Must contain **every** current item **exactly once** (full ordered set). Positions are rewritten `0..n-1`. A partial set, a duplicate, or a uuid from another list → `422`. → `200` with the reordered `items` array.

> **Foreign-parent guard**: for any `/lists/{listUuid}/items/{itemUuid}` call, if the item does not belong to that list you get `404` (indistinguishable from a missing item). Always use an item's real parent list.

---

## 4. Channel files

A per-channel document library. Files are **channel content** (member-only reads, same privacy rule as lists).

### File object
```json
{
  "id": 42,
  "url": "https://…signed-or-permanent…",
  "original_name": "brief.pdf",
  "mime_type": "application/pdf",
  "size": 128344,
  "category": "channel-file",
  "upload_status": "completed",
  "uploader": { "id": 7, "name": "Owner User" },
  "created_at": "2026-07-13T21:00:00+00:00"
}
```
`url` is a time-limited **signed URL** for private files (regenerated per response). `uploader` is present when loaded (it is on these endpoints).

### List the channel's files
`GET /api/channels/{channelUuid}/files?per_page=15` — paginated File objects (only `completed` uploads). Member-only.

### Upload a file
`POST /api/channels/{channelUuid}/files` · throttle 30/min — **multipart/form-data**, single field **`file`**.
- Max **15 MB**. Allowed: `pdf, doc, docx, txt, rtf, csv, xlsx, pptx, zip, jpg, jpeg, png, gif, webp` — validated by **both** extension and content type (a mismatched/spoofed file → `422`).
- → `201` with the File object. (Text is extracted from documents in the background so Lawexa can reference them. Archives and images have no text — Lawexa cannot reference them; zips are download-only and are **not** scanned for malware.)

### Download a file
`GET /api/files/{id}/download` (the existing generic endpoint) → returns/redirects to the file URL. Gated by membership: members `200`; non-members (incl. admins/governors) `403`.

### Delete a file
`DELETE /api/channels/{channelUuid}/files/{id}` → `200`. Allowed for the **uploader**, the **channel governance chain**, or a platform admin. Foreign-parent (a file id not in this channel) → `404`.

---

## 5. Realtime — `channels.{uuid}` presence channel

Both features broadcast on the **same** Echo presence channel the room already uses for `message.created`. Listen with a leading dot (`broadcastAs` names):

```js
const room = Echo.join(`channels.${channelUuid}`)
  // …existing message/member/ai listeners…
  .listen('.list.changed', ({ action, list }) => {
    // action: 'created' | 'updated' | 'deleted' | 'item_changed'
    // `list` is the FULL list object WITH its `items` array (a snapshot).
    if (action === 'deleted') dropList(list.uuid);
    else upsertListInPlace(list);           // replace the whole list; no per-item diffing
  })
  .listen('.file.changed', ({ action, file }) => {
    // action: 'added' | 'removed'; `file` is the File object
    if (action === 'removed') dropFile(file.id);
    else addFile(file);
  });
```

| Event | Payload | Notes |
|---|---|---|
| `.list.changed` | `{ action: 'created'\|'updated'\|'deleted'\|'item_changed', list: {…full list with items} }` | Fires on every list/item mutation (human **or** Lawexa). Re-render that list in place; on `deleted`, drop it by `list.uuid`. |
| `.file.changed` | `{ action: 'added'\|'removed', file: {…File} }` | Fires on channel-file upload/delete. |

**Delivery-only**: writes always go over HTTP (the tables above) — the socket only delivers the result. Because it's the room's member-authorized presence channel, non-members never receive these events.

**Lawexa's edits are live too**: when @lawexa creates a list, adds an item, or checks something (via its backend tools), the same `.list.changed` event fires with `is_ai: true` on the affected list/items. You don't need a separate channel or event for AI activity.

---

## 6. Permissions at a glance

| Action | Who |
|---|---|
| Read lists/files, add/check/reorder items | **Active channel member** only |
| Create a list, upload a file | Active channel member |
| Rename/delete a **list** | List creator **or** channel owner/admin **or** space owner/admin **or** platform admin |
| Delete a **file** | Uploader **or** channel owner/admin **or** space owner/admin **or** platform admin |
| (Space governors & platform admins reading content) | **Denied** (`403`) — Slack-style privacy |

---

## 7. Notes for the client

- **Two list shapes**: the **index** returns `items_count`/`checked_count` (no items); **show / create / update / the broadcast** return the `items` array. Fetch `GET /lists/{uuid}` when you need the items.
- **Ordering**: items are always returned sorted by `position`. Only `POST …/items/reorder` changes order (send the full ordered uuid set).
- **Optimistic UI**: safe to apply optimistically and reconcile on the `.list.changed`/`.file.changed` snapshot; the server is the source of truth for `position` and `checked_by`.
- **Identity rule**: show "Lawexa" when `is_ai === true` — never infer it from a `null` creator (a `null` creator can also mean a deleted human account).
- **Not exposed**: internal integer ids for lists/items, raw `created_by`, file `path`/`disk`/`hash`. Don't depend on fields not listed here.
