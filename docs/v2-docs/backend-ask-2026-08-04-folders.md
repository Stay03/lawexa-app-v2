# Folder asks — August 4, 2026

For the backend team. We are rebuilding the folders screens. These asks
describe what we want. You choose how to build it. Item 1 is a security
problem — please treat it as urgent.

## 1. URGENT — folder items leak other users' private conversations

- Today, "add item to folder" accepts a conversation by its NUMERIC id
  without checking who owns it. We verified with a fresh guest account
  that owns zero conversations: adding ids 1, 2, 3, 50 all succeeded.
- The folder-items list then shows those conversations' private titles
  and uuids — including ones marked private — while a direct read of the
  same conversation correctly returns 404.
- So anyone can walk the number line and harvest private conversation
  titles.
- We want: adding an item the caller cannot read to FAIL, and folder
  items to never show content the viewer could not open directly.
- The new folders screens will not offer conversations inside folders at
  all, but the API hole exists regardless of our screens.

## 2. Folder counts in the bookmarks list are always zero

- A folder bookmark row in `GET /api/bookmarks` reports
  `items_count: 0, children_count: 0` for every folder, always.
- The same folder at the same moment reports its true counts from the
  folder list, the folder detail, and the public feed.
- Our bookmarks page shows "0 items" on every saved folder because of
  this. We want the true counts in the bookmarks payload.

## 3. Two smaller wants (quality of life, not blockers)

- A way to ask which folders already contain a given item. The
  "Add to folder" picker wants to show "already in Contract law" instead
  of letting the user hit the duplicate error.
- A flat list of ALL the caller's folders with their paths. Today
  `my-folders` returns root folders only, so a picker must drill level
  by level to reach a subfolder.
