# Phase 7: Bookmarks - API Documentation

## Overview

Phase 7 implements a polymorphic bookmark system that allows users to save cases and notes for quick access later. The system uses a toggle-based approach where a single endpoint adds or removes bookmarks, and includes efficient `is_bookmarked` status and `bookmarks_count` on content resources to prevent N+1 queries.

---

## Table of Contents

1. [Bookmarks](#bookmarks)
2. [Content Resource Changes](#content-resource-changes)
3. [Error Responses](#error-responses)
4. [Data Models](#data-models)

---

## Bookmarks

### Authentication

All endpoints require `auth:sanctum` middleware.

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/bookmarks` | GET | Yes | Any |
| `/api/bookmarks` | POST | Yes | Any |
| `/api/bookmarks/check` | GET | Yes | Any |

---

### GET /api/bookmarks

List paginated bookmarks for the authenticated user.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | - | Filter by type (`case`, `note`) |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Response:**
```json
{
  "success": true,
  "message": "Bookmarks retrieved successfully.",
  "data": [
    {
      "id": 5,
      "type": "note",
      "content": {
        "id": 6,
        "title": "Test Draft Note",
        "slug": "test-draft-note-1768061884",
        "content_preview": "This is a test draft note.",
        "user": {
          "id": 2,
          "name": "Test User"
        },
        "tags": null,
        "price_ngn": "0.00",
        "price_usd": "0.00",
        "is_free": true,
        "thumbnail_url": null,
        "is_bookmarked": true,
        "bookmarks_count": 1,
        "created_at": "2026-01-10T16:18:04.000000Z"
      },
      "created_at": "2026-01-10T16:18:35.000000Z"
    },
    {
      "id": 3,
      "type": "case",
      "content": {
        "id": 1,
        "title": "INEC v. Peter Obi (Updated)",
        "slug": "inec-v-obi",
        "judgment_date": null,
        "citation": null,
        "is_bookmarked": true,
        "bookmarks_count": 2
      },
      "created_at": "2026-01-10T16:13:40.000000Z"
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
  "links": {
    "first": "http://127.0.0.1:8000/api/bookmarks?page=1",
    "last": "http://127.0.0.1:8000/api/bookmarks?page=1",
    "prev": null,
    "next": null
  }
}
```

**Filtered by Type (case):**
```json
{
  "success": true,
  "message": "Bookmarks retrieved successfully.",
  "data": [
    {
      "id": 3,
      "type": "case",
      "content": {
        "id": 1,
        "title": "INEC v. Peter Obi (Updated)",
        "slug": "inec-v-obi",
        "judgment_date": null,
        "citation": null,
        "is_bookmarked": true,
        "bookmarks_count": 2
      },
      "created_at": "2026-01-10T16:13:40.000000Z"
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
    "first": "http://127.0.0.1:8000/api/bookmarks?page=1",
    "last": "http://127.0.0.1:8000/api/bookmarks?page=1",
    "prev": null,
    "next": null
  }
}
```

**Empty Response:**
```json
{
  "success": true,
  "message": "Bookmarks retrieved successfully.",
  "data": [],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 0,
    "last_page": 1,
    "from": null,
    "to": null
  },
  "links": {
    "first": "http://127.0.0.1:8000/api/bookmarks?page=1",
    "last": "http://127.0.0.1:8000/api/bookmarks?page=1",
    "prev": null,
    "next": null
  }
}
```

**Invalid Type Filter:**
```json
{
  "success": false,
  "message": "Invalid bookmark type.",
  "errors": null
}
```

**Notes:**
- Bookmarks are ordered by newest first (most recent bookmark at top)
- Content is eagerly loaded with the bookmarkable relationship
- `per_page` is clamped to a maximum of 100
- Type filter accepts only `case` or `note`

---

### POST /api/bookmarks

Toggle a bookmark (add if not exists, remove if exists).

**Request Body:**
```json
{
  "type": "case",
  "id": 1
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `type` | string | Yes | Must be `case` or `note` |
| `id` | integer | Yes | Must be >= 1, content must exist |

**Response - Bookmark Added (201 Created):**
```json
{
  "success": true,
  "message": "Bookmark added.",
  "data": {
    "bookmarked": true,
    "bookmark": {
      "id": 3,
      "type": "case",
      "content": {
        "id": 1,
        "title": "INEC v. Peter Obi (Updated)",
        "slug": "inec-v-obi",
        "judgment_date": null,
        "citation": null,
        "is_bookmarked": true,
        "bookmarks_count": 1
      },
      "created_at": "2026-01-10T16:13:40.000000Z"
    }
  }
}
```

**Response - Bookmark Removed (200 OK):**
```json
{
  "success": true,
  "message": "Bookmark removed.",
  "data": {
    "bookmarked": false
  }
}
```

**Validation Error - Invalid Type:**
```json
{
  "success": false,
  "message": "The content type must be either \"case\" or \"note\". (and 1 more error)",
  "errors": {
    "type": [
      "The content type must be either \"case\" or \"note\".",
      "Invalid bookmark type."
    ]
  }
}
```

**Validation Error - Missing Type:**
```json
{
  "success": false,
  "message": "The content type is required.",
  "errors": {
    "type": ["The content type is required."]
  }
}
```

**Validation Error - Missing ID:**
```json
{
  "success": false,
  "message": "The content ID is required.",
  "errors": {
    "id": ["The content ID is required."]
  }
}
```

**Validation Error - Invalid ID (Zero):**
```json
{
  "success": false,
  "message": "The content ID must be at least 1.",
  "errors": {
    "id": ["The content ID must be at least 1."]
  }
}
```

**Validation Error - Invalid ID (Not Integer):**
```json
{
  "success": false,
  "message": "The content ID must be a valid integer. (and 1 more error)",
  "errors": {
    "id": [
      "The content ID must be a valid integer.",
      "The selected content does not exist."
    ]
  }
}
```

**Validation Error - Content Does Not Exist:**
```json
{
  "success": false,
  "message": "The selected content does not exist.",
  "errors": {
    "id": ["The selected content does not exist."]
  }
}
```

**Authorization Error - Content Not Visible (403):**
```json
{
  "success": false,
  "message": "Content not found.",
  "errors": null
}
```

**Notes:**
- Toggle behavior: calling twice returns to original state
- Cannot bookmark soft-deleted content
- Cannot bookmark other users' private or draft notes
- Can bookmark your own private and draft notes
- Admin can bookmark any content

---

### GET /api/bookmarks/check

Check if specific content is bookmarked by the current user.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | Yes | Content type (`case`, `note`) |
| `id` | integer | Yes | Content ID |

**Response - Bookmarked:**
```json
{
  "success": true,
  "message": "Bookmark status retrieved.",
  "data": {
    "bookmarked": true
  }
}
```

**Response - Not Bookmarked:**
```json
{
  "success": true,
  "message": "Bookmark status retrieved.",
  "data": {
    "bookmarked": false
  }
}
```

**Validation Error - Missing Parameters:**
```json
{
  "success": false,
  "message": "Type and ID are required.",
  "errors": null
}
```

**Validation Error - Invalid Type:**
```json
{
  "success": false,
  "message": "Invalid bookmark type.",
  "errors": null
}
```

**Notes:**
- Returns `bookmarked: false` for non-existent content IDs (no error)
- Quick way to check bookmark status without fetching full content

---

## Content Resource Changes

Phase 7 adds `is_bookmarked` and `bookmarks_count` fields to Case and Note resources.

### Case Resource

The `is_bookmarked` and `bookmarks_count` fields are added to both `CaseResource` and `CaseSummaryResource`.

**GET /api/cases/{slug} - Bookmarked (with count):**
```json
{
  "success": true,
  "message": "Case retrieved successfully.",
  "data": {
    "id": 1,
    "title": "INEC v. Peter Obi (Updated)",
    "slug": "inec-v-obi",
    "body": "The petitioner filed a case...",
    "court": {
      "id": 1,
      "name": "Supreme Court of Nigeria (Updated)",
      "slug": "supreme-court-of-nigeria",
      "abbreviation": "SCN"
    },
    "cited_by_count": 0,
    "is_bookmarked": true,
    "bookmarks_count": 2,
    "created_at": "2026-01-09T23:08:50.000000Z",
    "updated_at": "2026-01-09T23:09:46.000000Z"
  }
}
```

**GET /api/cases/{slug} - Not Bookmarked:**
```json
{
  "success": true,
  "message": "Case retrieved successfully.",
  "data": {
    "id": 2,
    "title": "Tinubu v. Atiku",
    "slug": "tinubu-v-atiku",
    "is_bookmarked": false,
    "bookmarks_count": 0
  }
}
```

**GET /api/cases (list) - With bookmark fields:**
```json
{
  "success": true,
  "message": "Cases retrieved successfully.",
  "data": [
    {
      "id": 1,
      "title": "INEC v. Peter Obi (Updated)",
      "slug": "inec-v-obi",
      "is_bookmarked": true,
      "bookmarks_count": 2
    },
    {
      "id": 2,
      "title": "Tinubu v. Atiku",
      "slug": "tinubu-v-atiku",
      "is_bookmarked": false,
      "bookmarks_count": 0
    }
  ]
}
```

### Note Resource

The `is_bookmarked` and `bookmarks_count` fields are added to both `NoteResource` and `NoteSummaryResource`.

**GET /api/notes/{slug} - Bookmarked (with count):**
```json
{
  "success": true,
  "message": "Note retrieved successfully.",
  "data": {
    "id": 2,
    "title": "Admin Modified Title",
    "slug": "admin-modified-title",
    "content": "This is the updated content.",
    "content_preview": "This is the updated content.",
    "user": {
      "id": 2,
      "name": "Test User"
    },
    "is_private": false,
    "tags": ["law", "test"],
    "price_ngn": "0.00",
    "price_usd": "0.00",
    "is_free": true,
    "is_paid": false,
    "status": "published",
    "thumbnail_url": null,
    "is_bookmarked": true,
    "bookmarks_count": 2,
    "created_at": "2026-01-10T13:35:02.000000Z",
    "updated_at": "2026-01-10T13:40:06.000000Z"
  }
}
```

**GET /api/notes (list) - With bookmark fields:**
```json
{
  "success": true,
  "message": "Notes retrieved successfully.",
  "data": [
    {
      "id": 2,
      "title": "Admin Modified Title",
      "slug": "admin-modified-title",
      "is_bookmarked": true,
      "bookmarks_count": 2
    },
    {
      "id": 5,
      "title": "Paid Note by Creator",
      "slug": "paid-note-by-creator",
      "is_bookmarked": false,
      "bookmarks_count": 0
    }
  ]
}
```

**Notes:**
- `is_bookmarked` is loaded efficiently via `withExists()` to prevent N+1 queries
- `bookmarks_count` is loaded efficiently via `withCount()` to prevent N+1 queries
- `is_bookmarked` returns `false` for unauthenticated requests
- `bookmarks_count` shows total bookmarks from all users
- Available on both list and detail endpoints

---

## Error Responses

### 401 Unauthorized

Returned when no valid authentication token is provided.

```json
{
  "success": false,
  "message": "Unauthenticated.",
  "errors": null
}
```

### 403 Forbidden

Returned when trying to bookmark content that is not visible to the user.

```json
{
  "success": false,
  "message": "Content not found.",
  "errors": null
}
```

### 422 Validation Error

Returned when request validation fails.

```json
{
  "success": false,
  "message": "The content type is required.",
  "errors": {
    "type": ["The content type is required."]
  }
}
```

Or with multiple errors:

```json
{
  "success": false,
  "message": "The content type must be either \"case\" or \"note\". (and 1 more error)",
  "errors": {
    "type": [
      "The content type must be either \"case\" or \"note\".",
      "Invalid bookmark type."
    ]
  }
}
```

---

## Data Models

### Bookmark Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique bookmark identifier |
| `type` | string | Content type (`case` or `note`) |
| `content` | object | The bookmarked content (CaseSummaryResource or NoteSummaryResource) |
| `created_at` | datetime | ISO 8601 timestamp when bookmark was created |

### Case Summary Resource (in Bookmark)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Case ID |
| `title` | string | Case title |
| `slug` | string | URL-friendly identifier |
| `court` | string\|null | Court name (when loaded) |
| `judgment_date` | string\|null | Judgment date (Y-m-d format) |
| `citation` | string\|null | Legal citation |
| `is_bookmarked` | boolean | Always `true` in bookmark list |
| `bookmarks_count` | integer | Total number of bookmarks from all users |

### Note Summary Resource (in Bookmark)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Note ID |
| `title` | string | Note title |
| `slug` | string | URL-friendly identifier |
| `content_preview` | string | Truncated content (150 chars) |
| `user` | object | Note creator (`id`, `name`) |
| `tags` | array\|null | Array of tag strings |
| `price_ngn` | string | Price in NGN (decimal) |
| `price_usd` | string | Price in USD (decimal) |
| `is_free` | boolean | True if both prices are 0 |
| `thumbnail_url` | string\|null | Thumbnail image URL |
| `is_bookmarked` | boolean | Always `true` in bookmark list |
| `bookmarks_count` | integer | Total number of bookmarks from all users |
| `created_at` | datetime | ISO 8601 timestamp |

---

## Authorization Rules

### Bookmark Visibility

| Content Type | Owner | Admin | Other Users |
|--------------|-------|-------|-------------|
| Case (any) | Can bookmark | Can bookmark | Can bookmark |
| Note (public published) | Can bookmark | Can bookmark | Can bookmark |
| Note (private published) | Can bookmark | Can bookmark | Cannot bookmark (403) |
| Note (draft) | Can bookmark | Can bookmark | Cannot bookmark (403) |
| Soft-deleted content | Cannot bookmark (422) | Cannot bookmark (422) | Cannot bookmark (422) |

### Bookmark Operations

| Action | Any Authenticated User |
|--------|----------------------|
| List own bookmarks | Yes |
| Add bookmark | Yes (if content is visible) |
| Remove bookmark | Yes (own bookmarks only) |
| Check if bookmarked | Yes |

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
    "first": "http://127.0.0.1:8000/api/bookmarks?page=1",
    "last": "http://127.0.0.1:8000/api/bookmarks?page=2",
    "prev": null,
    "next": "http://127.0.0.1:8000/api/bookmarks?page=2"
  }
}
```

---

## Notes

### Toggle Behavior

The POST endpoint uses toggle semantics:
1. If bookmark does not exist → Create it (returns 201)
2. If bookmark exists → Delete it (returns 200)

This simplifies frontend implementation as a single button/action handles both add and remove.

### Ordering

Bookmarks are always returned in reverse chronological order (newest first), based on when the bookmark was created.

### Content Cleanup

When a Case or Note is deleted:
- All associated bookmarks are automatically deleted via model observers
- No orphaned bookmark records remain in the database

### N+1 Query Prevention

The bookmark fields on Case and Note resources are loaded efficiently:
- `is_bookmarked` uses Laravel's `withExists()` to load user-specific bookmark status in a single subquery
- `bookmarks_count` uses Laravel's `withCount()` to load total bookmark count in a single subquery

This avoids N+1 queries when listing multiple items.

### Valid Bookmark Types

| Type | Maps To |
|------|---------|
| `case` | `App\Models\CourtCase` |
| `note` | `App\Models\Note` |

These mappings are configured via Laravel's morph map in `AppServiceProvider`.
