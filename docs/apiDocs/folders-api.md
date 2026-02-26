# Phase 18: Folders - API Documentation

## Overview

Phase 18 implements a folder system that allows users to organize content (cases, notes, conversations, and future content types) into hierarchical folders. Folders support unlimited nesting, public/private visibility, slug-based deep linking, bookmarking, and view tracking. Content can exist in multiple folders simultaneously via a polymorphic many-to-many pivot table.

**Key Features:**
- Hierarchical folder nesting with unlimited depth
- Materialized `slug_path` for deep linking (e.g., `work/contracts/2024`)
- Public/private visibility with `visibleTo` scoping
- Polymorphic folder items supporting `case`, `note`, `conversation`, and `folder` types
- Soft-delete with cascade to subfolders and cascade restore
- Circular reference prevention when moving folders
- Cross-user slug uniqueness (scoped to `user_id + slug_path`)
- Bookmarkable and viewable (integrates with existing Phase 7 and Phase 8 systems)
- Optional icon and color metadata

---

## Table of Contents

1. [Folder Endpoints](#folder-endpoints)
2. [Folder Item Endpoints](#folder-item-endpoints)
3. [Bookmark Integration](#bookmark-integration)
4. [Error Responses](#error-responses)
5. [Data Models](#data-models)
6. [Authorization Rules](#authorization-rules)

---

## Folder Endpoints

### Authentication

All endpoints require `auth:sanctum` middleware.

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/folders` | GET | Yes | Any |
| `/api/folders` | POST | Yes | Any |
| `/api/folders/my-folders` | GET | Yes | Any |
| `/api/folders/navigate/{path}` | GET | Yes | Any |
| `/api/folders/{folder}` | GET | Yes | Any |
| `/api/folders/{folder}` | PUT | Yes | Owner or Admin |
| `/api/folders/{folder}` | DELETE | Yes | Owner or Admin |
| `/api/folders/{id}/restore` | POST | Yes | Owner or Admin |
| `/api/folders/{folder}/items` | GET | Yes | Any (if visible) |
| `/api/folders/{folder}/items` | POST | Yes | Owner or Admin |
| `/api/folders/{folder}/items` | DELETE | Yes | Owner or Admin |

---

### POST /api/folders

Create a new folder.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | Max 255 characters |
| `parent_id` | string (UUID) | No | Must be an existing folder UUID owned by the user |
| `description` | string | No | Max 1000 characters |
| `icon` | string | No | Max 50 characters |
| `color` | string | No | Hex color code (e.g., `#3B82F6`) |
| `is_private` | boolean | No | Defaults to `false` |

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/folders" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"name": "Work Documents", "description": "All work related files", "icon": "briefcase", "color": "#3B82F6"}'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Folder created successfully.",
  "data": {
    "id": 1,
    "uuid": "fa985b12-90f2-4c74-bc3e-d14f0f5caef8",
    "name": "Work Documents",
    "slug": "work-documents",
    "slug_path": "work-documents",
    "description": "All work related files",
    "icon": "briefcase",
    "color": "#3B82F6",
    "is_private": false,
    "user": {
      "id": 2,
      "uuid": "a5b3e808-a3ad-4c1f-b1e7-d3af87d11536",
      "name": "Test User",
      "email": "test@example.com",
      "role": "user",
      "is_creator": false,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "created_at": "2026-01-16T00:28:33.000000Z"
    },
    "children_count": 0,
    "items_count": 0,
    "is_bookmarked": false,
    "bookmarks_count": 0,
    "views_count": 0,
    "created_at": "2026-02-26T03:49:45.000000Z",
    "updated_at": "2026-02-26T03:49:45.000000Z"
  }
}
```

**Response - Subfolder (201 Created):**
```json
{
  "success": true,
  "message": "Folder created successfully.",
  "data": {
    "id": 3,
    "uuid": "ca009ae5-e07f-4e46-8b2c-21b60c6bc776",
    "name": "Contracts",
    "slug": "contracts",
    "slug_path": "work-documents/contracts",
    "description": null,
    "icon": null,
    "color": null,
    "is_private": false,
    "user": { "..." : "..." },
    "children_count": 0,
    "items_count": 0,
    "is_bookmarked": false,
    "bookmarks_count": 0,
    "views_count": 0,
    "created_at": "2026-02-26T04:15:57.000000Z",
    "updated_at": "2026-02-26T04:15:57.000000Z"
  }
}
```

**Validation Error (422) - Missing Name:**
```json
{
  "success": false,
  "message": "The folder name is required.",
  "errors": {
    "name": ["The folder name is required."]
  }
}
```

**Validation Error (422) - Invalid Color:**
```json
{
  "success": false,
  "message": "The color field must not be greater than 7 characters. (and 1 more error)",
  "errors": {
    "color": [
      "The color field must not be greater than 7 characters.",
      "The color must be a valid hex color code (e.g. #3B82F6)."
    ]
  }
}
```

**Validation Error (422) - Parent Belongs to Another User:**
```json
{
  "success": false,
  "message": "You can only create subfolders in your own folders.",
  "errors": {
    "parent_id": ["You can only create subfolders in your own folders."]
  }
}
```

**Notes:**
- Slug is auto-generated from the name via `Str::slug()`
- If a sibling folder has the same slug, a random 4-character suffix is appended (e.g., `work-documents-smun`)
- `slug_path` is a materialized path built from the parent chain (e.g., `work/contracts/2024`)
- Different users can have folders with the same slug since uniqueness is scoped to `(user_id, slug_path)`
- `parent_id` must reference a folder owned by the authenticated user

---

### GET /api/folders

List public folders visible to the authenticated user.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | - | Search folders by name |
| `parent_id` | string (UUID) | - | Filter by parent folder (omit for root-level only) |
| `sort` | string | `created_at` | Sort field (`created_at`, `updated_at`, `name`) |
| `order` | string | `desc` | Sort direction (`asc`, `desc`) |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Example Request:**
```bash
curl "http://localhost:8000/api/folders?search=contracts&sort=name&order=asc" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Folders retrieved successfully.",
  "data": [
    {
      "id": 1,
      "uuid": "fa985b12-90f2-4c74-bc3e-d14f0f5caef8",
      "name": "Work Documents",
      "slug": "work-documents",
      "slug_path": "work-documents",
      "icon": "briefcase",
      "color": "#3B82F6",
      "is_private": false,
      "user": {
        "id": 2,
        "name": "Test User",
        "avatar_url": null
      },
      "children_count": 1,
      "items_count": 0,
      "is_bookmarked": false,
      "created_at": "2026-02-26T03:49:45.000000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 1,
    "last_page": 1,
    "from": 1,
    "to": 1
  },
  "links": {
    "first": "http://localhost:8000/api/folders?page=1",
    "last": "http://localhost:8000/api/folders?page=1",
    "prev": null,
    "next": null
  }
}
```

**Notes:**
- Returns root-level folders by default (no `parent_id` filter)
- Uses `FolderSummaryResource` for lightweight list responses
- Visibility: public folders from all users + user's own private folders
- Admin sees all folders regardless of visibility
- `is_bookmarked` is efficiently loaded via `withExists()`
- Counts (`children_count`, `items_count`) are loaded via `withCount()`

---

### GET /api/folders/my-folders

List the authenticated user's own folders (including private).

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | - | Search folders by name |
| `parent_id` | string (UUID) | - | Filter by parent folder |
| `is_private` | boolean | - | Filter by privacy (`true` or `false`) |
| `with_trashed` | boolean | `false` | Include soft-deleted folders |
| `sort` | string | `created_at` | Sort field (`created_at`, `updated_at`, `name`) |
| `order` | string | `desc` | Sort direction (`asc`, `desc`) |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Example Request:**
```bash
curl "http://localhost:8000/api/folders/my-folders?is_private=true" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Folders retrieved successfully.",
  "data": [
    {
      "id": 2,
      "uuid": "4ea7e141-44a0-4c83-a22a-869f5b54c6fb",
      "name": "Personal Notes",
      "slug": "personal-notes",
      "slug_path": "personal-notes",
      "description": null,
      "icon": null,
      "color": null,
      "is_private": true,
      "user": { "..." : "..." },
      "children_count": 0,
      "items_count": 0,
      "is_bookmarked": false,
      "bookmarks_count": 0,
      "views_count": 0,
      "created_at": "2026-02-26T03:50:56.000000Z",
      "updated_at": "2026-02-26T03:50:56.000000Z"
    }
  ],
  "pagination": { "..." : "..." },
  "links": { "..." : "..." }
}
```

**Notes:**
- Always returns only the authenticated user's own folders
- Uses full `FolderResource` (includes `description`, `bookmarks_count`, `views_count`)
- `with_trashed=true` includes soft-deleted folders for restore functionality
- Does not return other users' folders regardless of visibility

---

### GET /api/folders/{folder}

Show a single folder by UUID.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Folder retrieved successfully.",
  "data": {
    "id": 1,
    "uuid": "fa985b12-90f2-4c74-bc3e-d14f0f5caef8",
    "name": "Work Documents",
    "slug": "work-documents",
    "slug_path": "work-documents",
    "description": "All work related files",
    "icon": "briefcase",
    "color": "#3B82F6",
    "is_private": false,
    "user": {
      "id": 2,
      "uuid": "a5b3e808-a3ad-4c1f-b1e7-d3af87d11536",
      "name": "Test User",
      "email": "test@example.com",
      "role": "user",
      "is_creator": false,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "created_at": "2026-01-16T00:28:33.000000Z"
    },
    "parent": null,
    "children": [
      {
        "id": 3,
        "uuid": "ca009ae5-e07f-4e46-8b2c-21b60c6bc776",
        "name": "Contracts",
        "slug": "contracts",
        "slug_path": "work-documents/contracts",
        "icon": null,
        "color": null,
        "is_private": false,
        "children_count": 1,
        "items_count": 2,
        "is_bookmarked": false,
        "created_at": "2026-02-26T04:15:57.000000Z"
      }
    ],
    "children_count": 1,
    "items_count": 0,
    "is_bookmarked": true,
    "bookmarks_count": 1,
    "views_count": 0,
    "created_at": "2026-02-26T03:49:45.000000Z",
    "updated_at": "2026-02-26T04:16:52.000000Z"
  }
}
```

**Error Response (404) - Not Found or Not Visible:**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

**Notes:**
- Uses UUID-based route model binding (`{folder:uuid}`)
- Includes `parent` (summary), `children` (summary list), and `user` (full)
- Other users' private folders return 404 (not 403) to avoid information leakage
- Admin can view any folder
- Triggers view tracking via `TrackView` middleware

---

### GET /api/folders/navigate/{path}

Deep link to a folder by its materialized slug path.

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | Slash-separated slug path (e.g., `work/contracts/2024`) |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `owner_id` | integer | No | Specify the folder owner's user ID (for cross-user navigation) |

**Example Request:**
```bash
curl "http://localhost:8000/api/folders/navigate/work-files/contracts/2024" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Folder retrieved successfully.",
  "data": {
    "id": 5,
    "uuid": "b4d85742-bca0-4214-ade3-f445803d2929",
    "name": "2024",
    "slug": "2024",
    "slug_path": "work-files/contracts/2024",
    "description": null,
    "icon": null,
    "color": null,
    "is_private": false,
    "user": { "..." : "..." },
    "parent": {
      "id": 3,
      "uuid": "ca009ae5-e07f-4e46-8b2c-21b60c6bc776",
      "name": "Contracts",
      "slug": "contracts",
      "slug_path": "work-files/contracts",
      "icon": null,
      "color": null,
      "is_private": false,
      "children_count": 0,
      "items_count": 0,
      "is_bookmarked": false,
      "created_at": "2026-02-26T04:15:57.000000Z"
    },
    "children": [],
    "children_count": 0,
    "items_count": 1,
    "is_bookmarked": false,
    "bookmarks_count": 0,
    "views_count": 0,
    "created_at": "2026-02-26T17:07:20.000000Z",
    "updated_at": "2026-02-26T17:07:20.000000Z"
  }
}
```

**Cross-User Navigation:**
```bash
curl "http://localhost:8000/api/folders/navigate/work-files/contracts/2024?owner_id=2" \
  -H "Authorization: Bearer {other_user_token}" \
  -H "Accept: application/json"
```

**Error Response (404) - Path Not Found:**
```json
{
  "success": false,
  "message": "Folder not found.",
  "errors": null
}
```

**Notes:**
- Path is the full materialized slug path (e.g., `work-files/contracts/2024`)
- Without `owner_id`, searches the authenticated user's folders first, then public folders
- With `owner_id`, searches that specific user's folders (respects visibility rules)
- Other users' private folders return 404
- The `{path}` route parameter uses `->where('path', '.*')` to allow slashes

---

### PUT /api/folders/{folder}

Update a folder.

**Authorization:** Owner or Admin.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | No | Max 255 characters |
| `parent_id` | string (UUID) \| null | No | Move to new parent (null = make root) |
| `description` | string | No | Max 1000 characters |
| `icon` | string | No | Max 50 characters |
| `color` | string | No | Hex color code |
| `is_private` | boolean | No | Toggle visibility |

**Example Request:**
```bash
curl -X PUT "http://localhost:8000/api/folders/{uuid}" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"name": "Work Files", "color": "#EF4444"}'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Folder updated successfully.",
  "data": {
    "id": 1,
    "uuid": "fa985b12-90f2-4c74-bc3e-d14f0f5caef8",
    "name": "Work Files",
    "slug": "work-files",
    "slug_path": "work-files",
    "description": "All work related files",
    "icon": "briefcase",
    "color": "#EF4444",
    "is_private": false,
    "user": { "..." : "..." },
    "children_count": 0,
    "items_count": 0,
    "is_bookmarked": false,
    "bookmarks_count": 0,
    "views_count": 0,
    "created_at": "2026-02-26T03:49:45.000000Z",
    "updated_at": "2026-02-26T04:16:37.000000Z"
  }
}
```

**Validation Error (422) - Circular Reference:**
```json
{
  "success": false,
  "message": "Cannot move folder into its own subfolder.",
  "errors": null
}
```

**Error Response (403) - Not Owner:**
```json
{
  "success": false,
  "message": "This action is unauthorized.",
  "errors": null
}
```

**Notes:**
- When `name` changes, slug and slug_path are regenerated
- Slug path changes cascade to all descendant folders automatically
- Moving a folder (changing `parent_id`) triggers circular reference detection
- Cannot move a folder into itself or any of its descendants
- Only sends fields you want to change (all fields are `sometimes`)

---

### DELETE /api/folders/{folder}

Soft-delete a folder and cascade to all subfolders.

**Authorization:** Owner or Admin.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Folder deleted successfully.",
  "data": null
}
```

**Error Response (403) - Not Owner:**
```json
{
  "success": false,
  "message": "You are not authorized to delete this folder.",
  "errors": null
}
```

**Notes:**
- Soft-deletes the folder and all descendant subfolders recursively
- Folder items (pivot records) are preserved so restore brings items back
- Deleted folders are excluded from all list and show endpoints
- Use `my-folders?with_trashed=true` to see deleted folders

---

### POST /api/folders/{id}/restore

Restore a soft-deleted folder and cascade to all subfolders.

**Authorization:** Owner or Admin.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | The folder's primary ID (not UUID) |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Folder restored successfully.",
  "data": {
    "id": 1,
    "uuid": "fa985b12-90f2-4c74-bc3e-d14f0f5caef8",
    "name": "Work Files",
    "slug": "work-files",
    "slug_path": "work-files",
    "description": "All work related files",
    "icon": "briefcase",
    "color": "#EF4444",
    "is_private": false,
    "user": { "..." : "..." },
    "children": [
      {
        "id": 3,
        "uuid": "ca009ae5-e07f-4e46-8b2c-21b60c6bc776",
        "name": "Contracts",
        "slug": "contracts",
        "slug_path": "work-files/contracts",
        "icon": null,
        "color": null,
        "is_private": false,
        "children_count": 0,
        "items_count": 0,
        "is_bookmarked": false,
        "created_at": "2026-02-26T04:15:57.000000Z"
      }
    ],
    "children_count": 0,
    "items_count": 0,
    "is_bookmarked": false,
    "bookmarks_count": 0,
    "views_count": 0,
    "created_at": "2026-02-26T03:49:45.000000Z",
    "updated_at": "2026-02-26T04:16:52.000000Z"
  }
}
```

**Error Response (403) - Not Owner:**
```json
{
  "success": false,
  "message": "You are not authorized to restore this folder.",
  "errors": null
}
```

**Error Response (404) - Not Found:**
```json
{
  "success": false,
  "message": "Folder not found.",
  "errors": null
}
```

**Notes:**
- Restores the folder and all subfolders that were cascade-deleted at the same time (within a 1-second window)
- Folder items are preserved through delete/restore cycles
- Uses the folder's primary `id` (not UUID) since soft-deleted models aren't resolved via route model binding

---

## Folder Item Endpoints

### GET /api/folders/{folder}/items

List items in a folder.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | - | Filter by content type (`case`, `note`, `conversation`, `folder`) |
| `sort` | string | `created_at` | Sort field |
| `order` | string | `desc` | Sort direction (`asc`, `desc`) |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Example Request:**
```bash
curl "http://localhost:8000/api/folders/{uuid}/items?type=note" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Folder items retrieved successfully.",
  "data": [
    {
      "id": 3,
      "type": "note",
      "content": {
        "id": 22,
        "title": "LAW OF EQUITY: WHAT IS ACTUAL NOTICE?",
        "slug": "law-of-equity-what-is-actual-notice",
        "content_preview": "I. Definition and Overview...",
        "user": {
          "id": 2,
          "name": "Test User",
          "avatar_url": null
        },
        "tags": ["Equity", "actual notice"],
        "price_ngn": "1200.00",
        "price_usd": null,
        "is_free": false,
        "thumbnail_url": "https://example.com/thumbnail.jpeg",
        "is_bookmarked": false,
        "bookmarks_count": 0,
        "views_count": 0,
        "created_at": "2025-11-24T14:40:03.000000Z"
      },
      "added_at": "2026-02-26T17:09:33.000000Z"
    },
    {
      "id": 2,
      "type": "conversation",
      "content": {
        "id": "b77fc828-5ab9-4458-a806-fa76418bc59f",
        "title": "Hello, what can you do?",
        "status": "active",
        "is_private": true,
        "created_at": "2026-01-20T12:09:48+00:00"
      },
      "added_at": "2026-02-26T17:09:33.000000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 2,
    "last_page": 1,
    "from": 1,
    "to": 2
  },
  "links": { "..." : "..." }
}
```

**Error Response (404) - Folder Not Visible:**
```json
{
  "success": false,
  "message": "Folder not found.",
  "errors": null
}
```

**Notes:**
- Any user can list items in a public folder
- Private folder items are only visible to the owner and admin
- Content is resolved polymorphically using the existing resource for each type (NoteSummaryResource, CaseSummaryResource, ConversationSummaryResource, FolderSummaryResource)
- Items are ordered by `created_at` descending (most recently added first)

---

### POST /api/folders/{folder}/items

Add an item to a folder.

**Authorization:** Folder owner or Admin.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `type` | string | Yes | Must be `case`, `note`, `conversation`, or `folder` |
| `id` | integer | Yes | Must exist in the database for the given type |

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/folders/{uuid}/items" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"type": "note", "id": 21}'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Item added to folder successfully.",
  "data": {
    "id": 1,
    "type": "note",
    "content": {
      "id": 21,
      "title": "Law of Contract Note (Misrepresentation)",
      "slug": "law-of-contract-note-misrepresentation",
      "content_preview": "Section 6 (1) of the 1999 Constitution...",
      "user": {
        "id": 2,
        "name": "Test User",
        "avatar_url": null
      },
      "tags": [],
      "price_ngn": null,
      "price_usd": null,
      "is_free": true,
      "thumbnail_url": null,
      "is_bookmarked": false,
      "bookmarks_count": 0,
      "views_count": 0,
      "created_at": "2025-11-24T11:19:55.000000Z"
    },
    "added_at": "2026-02-26T17:09:32.000000Z"
  }
}
```

**Validation Error (422) - Duplicate Item:**
```json
{
  "success": false,
  "message": "This item is already in the folder.",
  "errors": null
}
```

**Validation Error (422) - Invalid Type:**
```json
{
  "success": false,
  "message": "The content type must be \"case\", \"note\", \"conversation\", or \"folder\". (and 1 more error)",
  "errors": {
    "type": [
      "The content type must be \"case\", \"note\", \"conversation\", or \"folder\".",
      "Invalid content type."
    ]
  }
}
```

**Validation Error (422) - Content Not Found:**
```json
{
  "success": false,
  "message": "The selected content does not exist.",
  "errors": {
    "id": ["The selected content does not exist."]
  }
}
```

**Error Response (403) - Not Folder Owner:**
```json
{
  "success": false,
  "message": "This action is unauthorized.",
  "errors": null
}
```

**Notes:**
- The same content can be added to multiple folders
- Each content item can only appear once per folder (unique constraint on `folder_id + folderable_type + folderable_id`)
- Content existence is validated polymorphically via the morph map
- Only the folder owner (or admin) can add items

---

### DELETE /api/folders/{folder}/items

Remove an item from a folder.

**Authorization:** Folder owner or Admin.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `type` | string | Yes | Must be `case`, `note`, `conversation`, or `folder` |
| `id` | integer | Yes | Must exist in the database for the given type |

**Example Request:**
```bash
curl -X DELETE "http://localhost:8000/api/folders/{uuid}/items" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"type": "note", "id": 21}'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Item removed from folder successfully.",
  "data": null
}
```

**Error Response (404) - Item Not in Folder:**
```json
{
  "success": false,
  "message": "Item not found in folder.",
  "errors": null
}
```

**Error Response (403) - Not Folder Owner:**
```json
{
  "success": false,
  "message": "This action is unauthorized.",
  "errors": null
}
```

**Notes:**
- Removing an item from a folder does **not** delete the actual content (case, note, conversation, or folder)
- Only removes the pivot record linking content to folder
- The content remains accessible via its own endpoints and in other folders

---

## Bookmark Integration

Folders integrate with the existing Phase 7 bookmark system. The bookmark type `folder` has been added.

### Toggle Folder Bookmark

```bash
curl -X POST "http://localhost:8000/api/bookmarks" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"type": "folder", "id": 1}'
```

**Response - Bookmark Added (201 Created):**
```json
{
  "success": true,
  "message": "Bookmark added.",
  "data": {
    "bookmarked": true,
    "bookmark": {
      "id": 1,
      "type": "folder",
      "content": {
        "id": 1,
        "uuid": "fa985b12-90f2-4c74-bc3e-d14f0f5caef8",
        "name": "Work Files",
        "slug": "work-files",
        "slug_path": "work-files",
        "icon": "briefcase",
        "color": "#EF4444",
        "is_private": false,
        "children_count": 0,
        "items_count": 0,
        "is_bookmarked": true,
        "created_at": "2026-02-26T03:49:45.000000Z"
      },
      "created_at": "2026-02-26T17:13:14.000000Z"
    }
  }
}
```

### Check Folder Bookmark Status

```bash
curl "http://localhost:8000/api/bookmarks/check?type=folder&id=1" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Bookmark status retrieved.",
  "data": {
    "bookmarked": true
  }
}
```

### Filter Bookmarks by Folder Type

```bash
curl "http://localhost:8000/api/bookmarks?type=folder" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Notes:**
- Bookmark `type` for folders is `folder`
- Folder bookmarks use `FolderSummaryResource` for the content payload
- `is_bookmarked` flag is included on all folder responses
- `bookmarks_count` is included on full folder responses
- Private folders can only be bookmarked by the owner and admin
- Bookmarks are automatically cleaned up when a folder is force-deleted

---

## Error Responses

### Common HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created successfully |
| 401 | Unauthenticated |
| 403 | Forbidden - Unauthorized action |
| 404 | Resource not found or not visible |
| 422 | Validation error |

### 401 Unauthenticated

Returned when no valid authentication token is provided.

```json
{
  "success": false,
  "message": "Unauthenticated.",
  "errors": null
}
```

### 403 Forbidden

Returned when the user lacks permission to modify a folder.

```json
{
  "success": false,
  "message": "This action is unauthorized.",
  "errors": null
}
```

### 404 Not Found

Returned for non-existent folders or private folders not visible to the user.

```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

### 422 Validation Error

Returned when request validation fails.

```json
{
  "success": false,
  "message": "The folder name is required.",
  "errors": {
    "name": ["The folder name is required."]
  }
}
```

---

## Data Models

### Folder Resource (Full)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Primary key |
| `uuid` | string | UUID used in API URLs |
| `name` | string | Folder name |
| `slug` | string | URL-friendly slug |
| `slug_path` | string | Materialized path (e.g., `work/contracts/2024`) |
| `description` | string\|null | Folder description |
| `icon` | string\|null | Icon identifier |
| `color` | string\|null | Hex color code |
| `is_private` | boolean | Whether folder is private |
| `user` | object | Folder owner (full user resource) |
| `parent` | object\|null | Parent folder (FolderSummaryResource, when loaded) |
| `children` | array | Child folders (FolderSummaryResource[], when loaded) |
| `children_count` | integer | Number of direct child folders |
| `items_count` | integer | Number of items in folder |
| `is_bookmarked` | boolean | Whether current user has bookmarked this folder |
| `bookmarks_count` | integer | Total bookmarks from all users |
| `views_count` | integer | Total view count |
| `created_at` | datetime | ISO 8601 creation timestamp |
| `updated_at` | datetime | ISO 8601 last update timestamp |

### Folder Summary Resource (Lightweight)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Primary key |
| `uuid` | string | UUID |
| `name` | string | Folder name |
| `slug` | string | URL-friendly slug |
| `slug_path` | string | Materialized path |
| `icon` | string\|null | Icon identifier |
| `color` | string\|null | Hex color code |
| `is_private` | boolean | Whether folder is private |
| `user` | object | Owner (inline: `id`, `name`, `avatar_url`) |
| `children_count` | integer | Number of direct child folders |
| `items_count` | integer | Number of items in folder |
| `is_bookmarked` | boolean | Whether current user has bookmarked |
| `created_at` | datetime | ISO 8601 creation timestamp |

### Folder Item Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Pivot record ID |
| `type` | string | Content type (`case`, `note`, `conversation`, `folder`) |
| `content` | object | Polymorphic content resource (CaseSummaryResource, NoteSummaryResource, ConversationSummaryResource, or FolderSummaryResource) |
| `added_at` | datetime | ISO 8601 timestamp when item was added to folder |

### Valid Folder Item Types

| Type | Maps To | Resource |
|------|---------|----------|
| `case` | `App\Models\CourtCase` | CaseSummaryResource |
| `note` | `App\Models\Note` | NoteSummaryResource |
| `conversation` | `App\Models\Conversation` | ConversationSummaryResource |
| `folder` | `App\Models\Folder` | FolderSummaryResource |

These mappings are configured via Laravel's morph map in `AppServiceProvider`.

**Note:** Adding a folder to itself is prevented with a 422 validation error.

---

## Authorization Rules

### Folder Visibility

| Folder Type | Owner | Admin | Other Users |
|-------------|-------|-------|-------------|
| Public folder | Can view | Can view | Can view |
| Private folder | Can view | Can view | Cannot view (404) |

### Folder Operations

| Action | Owner | Admin | Other Users |
|--------|-------|-------|-------------|
| Create folder | Yes | Yes | Yes (own only) |
| Create subfolder | In own folders | In any folder | In own folders only (422) |
| View folder | Yes | Yes | Public only (404 for private) |
| Update folder | Yes | Yes | No (403) |
| Delete folder | Yes | Yes | No (403) |
| Restore folder | Yes | Yes | No (403) |
| Add item | Yes | Yes | No (403) |
| Remove item | Yes | Yes | No (403) |
| List items | Yes | Yes | Public folders only (404) |
| Bookmark folder | Yes | Yes | Public folders only |
| Deep link (navigate) | Own folders | All folders | Public folders only (404) |

---

## Pagination

### Default Values

| Parameter | Default | Maximum |
|-----------|---------|---------|
| `per_page` | 15 | 100 |
| `page` | 1 | - |

### Pagination Response

```json
{
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 25,
    "last_page": 2,
    "from": 1,
    "to": 15
  },
  "links": {
    "first": "http://localhost:8000/api/folders?page=1",
    "last": "http://localhost:8000/api/folders?page=2",
    "prev": null,
    "next": "http://localhost:8000/api/folders?page=2"
  }
}
```

---

## Notes

### Slug Path System

The `slug_path` is a materialized path that represents the full hierarchy of a folder:

```
Root folder slug_path:     "work"
Child folder slug_path:    "work/contracts"
Grandchild slug_path:      "work/contracts/2024"
```

- Slug paths are automatically built from the parent chain on creation
- Renaming a folder cascades slug_path updates to all descendants
- Uniqueness is scoped to `(user_id, slug_path)` — different users can have identical paths
- The navigate endpoint resolves folders by their slug_path for deep linking

### Cascade Soft-Delete & Restore

- **Delete:** Soft-deletes the folder and recursively soft-deletes all descendant subfolders
- **Restore:** Restores the folder and all subfolders that were cascade-deleted within the same 1-second window
- Folder items (pivot records) are preserved through delete/restore cycles
- Folder items are cascade-deleted via foreign key when a folder is force-deleted

### Circular Reference Prevention

When moving a folder via the update endpoint (`parent_id` change), the system walks up the parent chain from the target parent to detect cycles. Moving a folder into itself or any of its descendants is rejected with a 422 error.

### N+1 Query Prevention

- `is_bookmarked` uses `withExists()` for user-specific bookmark status
- `bookmarks_count`, `views_count`, `children_count`, `items_count` use `withCount()`
- Children and parent relationships are eager-loaded on show endpoints

### Content Cleanup

- When a folder is force-deleted, all associated bookmarks and folder items are automatically deleted
- Soft-deleting a folder preserves all bookmarks and items for potential restore
- Removing an item from a folder never deletes the actual content
