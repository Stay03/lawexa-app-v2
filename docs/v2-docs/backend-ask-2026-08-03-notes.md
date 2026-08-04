# Notes asks — August 3, 2026

**ANSWERED — all six (August 4, 2026).** Everything is live on prod
(their commit `54d44e0`). Full reply: `Stay03/lawexa-api-v3`
`docs/frontend-replies/reply-2026-08-04-notes-rebuild.md`. Short form:
title now optional (null in payloads, render "Untitled" client-side);
slug set once, changes only on an explicit `slug` field (old link 404s
— warn in UI); new `GET /api/notes/by-id/{id}`; `DELETE /api/files/{id}`
already existed; 60 saves/min notes-only bucket with readable
`X-RateLimit-*` + `Retry-After` (429 without Retry-After = creation
quota); content limit is 5MB — 65,535 is stale, delete it.

For the backend team. We are rebuilding the notes screens, including
writing. These asks describe what we want. You choose how to build it.

The first two shape the product. The rest are hygiene.

## 1. Save a note that has no title yet

- Today, creating a note requires a title. A writer who has typed four
  paragraphs but no title has nothing saved on the server.
- We want work in progress to be storable before the writer names it.

## 2. A stable note address

- Today, renaming a note changes its address (the slug follows the title).
- While auto-save runs, every title edit changes the note's link, and links
  shared before a rename break.
- We want a note's address to stay stable once created.

## 3. Open a note by its number

- Today a note can only be fetched by its title-based address. If the
  address just changed, a reload fails.
- We want to fetch a note by its id as well.

## 4. Delete unused images

- Today an image can be uploaded but never removed. Images from abandoned
  notes pile up forever.
- We want a way to delete an uploaded file we no longer use.

## 5. Tell us the save rate limit

- Auto-save writes often. Tell us the request limit that applies to saving
  notes so we stay comfortably inside it.

## 6. One content size limit

- The API docs say a note's content can be 5MB. The current screen counts
  against 65,535 characters. Tell us which number is true.
