# Phase 6: Notes - API Documentation

## Overview

Phase 6 implements a notes marketplace system allowing users to create, publish, and sell study notes. Creators (users with `is_creator` flag) can set prices on their notes, while regular users can only create free notes. The system includes draft/published workflow, public/private visibility, thumbnail management, and content image uploads.

---

## Table of Contents

1. [Notes](#notes)
2. [Files](#files)
3. [Error Responses](#error-responses)
4. [Data Models](#data-models)

---

## Notes

### Authentication

All endpoints require `auth:sanctum` middleware.

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/notes` | GET | Yes | Any |
| `/api/notes` | POST | Yes | Any |
| `/api/notes/my-notes` | GET | Yes | Any |
| `/api/notes/{slug}` | GET | Yes | Any |
| `/api/notes/{id}` | PUT | Yes | Owner/Admin |
| `/api/notes/{id}` | DELETE | Yes | Owner/Admin |
| `/api/notes/{id}/restore` | POST | Yes | Admin |
| `/api/notes/{id}/publish` | POST | Yes | Owner/Admin |
| `/api/notes/{id}/unpublish` | POST | Yes | Owner/Admin |
| `/api/notes/{id}/thumbnail` | POST | Yes | Owner/Admin |
| `/api/notes/{id}/thumbnail` | DELETE | Yes | Owner/Admin |

---

### GET /api/notes

List paginated public published notes.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | - | Filter by title or content |
| `tags` | string/array | - | Filter by tags (comma-separated or array) |
| `free` | boolean | - | Show only free notes |
| `paid` | boolean | - | Show only paid notes |
| `user` | int/string | - | Filter by user ID or name |
| `sort` | string | `created_at` | Sort field (title, created_at, updated_at, price_ngn, price_usd) |
| `order` | string | `desc` | Sort order (asc, desc) |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Response:**
```json
{
  "success": true,
  "message": "Notes retrieved successfully.",
  "data": [
    {
      "id": 1,
      "title": "Constitutional Law Fundamentals",
      "slug": "constitutional-law-fundamentals",
      "content_preview": "This comprehensive guide covers the basic principles of constitutional law...",
      "is_private": false,
      "tags": ["constitutional", "law", "fundamentals"],
      "price_ngn": "500.00",
      "price_usd": "1.00",
      "is_free": false,
      "is_paid": true,
      "status": "published",
      "thumbnail_url": "http://localhost:8000/storage/notes/thumbnails/abc123.jpg",
      "user": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com",
        "role": "user",
        "is_creator": true,
        "is_verified": true,
        "auth_provider": "email",
        "avatar_url": null,
        "created_at": "2026-01-10T10:00:00.000000Z"
      },
      "created_at": "2026-01-10T10:00:00.000000Z",
      "updated_at": "2026-01-10T10:00:00.000000Z"
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
    "first": "http://localhost:8000/api/notes?page=1",
    "last": "http://localhost:8000/api/notes?page=1",
    "prev": null,
    "next": null
  }
}
```

**Empty Response:**
```json
{
  "success": true,
  "message": "Notes retrieved successfully.",
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
    "first": "http://localhost:8000/api/notes?page=1",
    "last": "http://localhost:8000/api/notes?page=1",
    "prev": null,
    "next": null
  }
}
```

**Notes:**
- Only returns public, published notes
- Draft and private notes are excluded
- Bot requests receive SEO-optimized responses

---

### GET /api/notes/my-notes

List paginated notes owned by the authenticated user.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | - | Filter by title or content |
| `tags` | string/array | - | Filter by tags |
| `free` | boolean | - | Show only free notes |
| `paid` | boolean | - | Show only paid notes |
| `status` | string | - | Filter by status (draft, published) |
| `is_private` | boolean | - | Filter by privacy |
| `with_trashed` | boolean | - | Include soft-deleted notes |
| `sort` | string | `created_at` | Sort field (title, created_at, updated_at, price_ngn, price_usd, status) |
| `order` | string | `desc` | Sort order (asc, desc) |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Response:**
```json
{
  "success": true,
  "message": "Notes retrieved successfully.",
  "data": [
    {
      "id": 1,
      "title": "My Draft Note",
      "slug": "my-draft-note",
      "content": "Full content visible to owner...",
      "content_preview": "Full content visible to owner...",
      "user": {
        "id": 2,
        "name": "Test User",
        "email": "test@example.com",
        "role": "user",
        "is_creator": false,
        "is_verified": true,
        "auth_provider": "email",
        "avatar_url": null,
        "created_at": "2026-01-08T03:50:56.000000Z"
      },
      "is_private": false,
      "tags": ["law", "notes"],
      "price_ngn": "0.00",
      "price_usd": "0.00",
      "is_free": true,
      "is_paid": false,
      "status": "draft",
      "thumbnail_url": null,
      "created_at": "2026-01-10T05:33:43.000000Z",
      "updated_at": "2026-01-10T05:36:06.000000Z"
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
    "first": "http://localhost:8000/api/notes/my-notes?page=1",
    "last": "http://localhost:8000/api/notes/my-notes?page=1",
    "prev": null,
    "next": null
  }
}
```

**Notes:**
- Returns all notes owned by the authenticated user
- Includes drafts, private notes, and optionally soft-deleted notes
- Full content is always visible to the owner

---

### GET /api/notes/{slug}

Get a specific note by its slug.

**Response (Owner/Admin or Free Note):**
```json
{
  "success": true,
  "message": "Note retrieved successfully.",
  "data": {
    "id": 1,
    "title": "Constitutional Law Fundamentals",
    "slug": "constitutional-law-fundamentals",
    "content": "Full content here...",
    "content_preview": "Full content here...",
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "is_creator": true,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "created_at": "2026-01-10T10:00:00.000000Z"
    },
    "is_private": false,
    "tags": ["constitutional", "law"],
    "price_ngn": "0.00",
    "price_usd": "0.00",
    "is_free": true,
    "is_paid": false,
    "status": "published",
    "thumbnail_url": null,
    "created_at": "2026-01-10T10:00:00.000000Z",
    "updated_at": "2026-01-10T10:00:00.000000Z"
  }
}
```

**Response (Paid Note - Non-Owner):**
```json
{
  "success": true,
  "message": "Note retrieved successfully.",
  "data": {
    "id": 1,
    "title": "Premium Law Notes",
    "slug": "premium-law-notes",
    "content": null,
    "content_preview": "This comprehensive guide covers...",
    "user": {
      "id": 1,
      "name": "John Doe"
    },
    "is_private": false,
    "tags": ["premium"],
    "price_ngn": "1000.00",
    "price_usd": "2.00",
    "is_free": false,
    "is_paid": true,
    "status": "published",
    "thumbnail_url": null,
    "created_at": "2026-01-10T10:00:00.000000Z",
    "updated_at": "2026-01-10T10:00:00.000000Z"
  }
}
```

**Not Found (Draft/Private Note):**
```json
{
  "success": false,
  "message": "Note not found.",
  "errors": null
}
```

**Notes:**
- Uses **slug** for lookup
- Draft notes return 404 to non-owners
- Private notes return 404 to non-owners
- Paid notes hide full content from non-owners (content returns null)
- Owner and admin always see full content

---

### POST /api/notes

Create a new note.

**Request Body:**
```json
{
  "title": "My New Note",
  "content": "This is the note content...",
  "is_private": false,
  "tags": ["law", "study"],
  "price_ngn": 500,
  "price_usd": 1.00,
  "status": "draft",
  "thumbnail_url": "https://example.com/image.jpg"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | Max 500 chars |
| `content` | string | Yes | Max 5MB (~5 million chars) |
| `slug` | string | No | Max 500 chars, lowercase alphanumeric with hyphens |
| `is_private` | boolean | No | Default: false |
| `tags` | array | No | Each tag max 100 chars |
| `price_ngn` | numeric | No | Min 0, max from config (default 100000) |
| `price_usd` | numeric | No | Min 0, max 10000 |
| `status` | string | No | draft or published (default: draft) |
| `thumbnail_url` | url | No | Max 2048 chars |

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Note created successfully.",
  "data": {
    "id": 1,
    "title": "My New Note",
    "slug": "my-new-note",
    "content": "This is the note content...",
    "content_preview": "This is the note content...",
    "user": {
      "id": 2,
      "name": "Test User",
      "email": "test@example.com",
      "role": "user",
      "is_creator": false,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "created_at": "2026-01-08T03:50:56.000000Z"
    },
    "is_private": false,
    "tags": ["law", "study"],
    "price_ngn": "0.00",
    "price_usd": "0.00",
    "is_free": true,
    "is_paid": false,
    "status": "draft",
    "thumbnail_url": null,
    "created_at": "2026-01-10T05:33:43.000000Z",
    "updated_at": "2026-01-10T05:33:43.000000Z"
  }
}
```

**Validation Error - Missing Title:**
```json
{
  "success": false,
  "message": "Please provide a note title.",
  "errors": {
    "title": ["Please provide a note title."]
  }
}
```

**Validation Error - Missing Content:**
```json
{
  "success": false,
  "message": "Please provide the note content.",
  "errors": {
    "content": ["Please provide the note content."]
  }
}
```

**Validation Error - Content Too Large:**
```json
{
  "success": false,
  "message": "Note content cannot exceed 5MB.",
  "errors": {
    "content": ["Note content cannot exceed 5MB."]
  }
}
```

**Validation Error - Non-Creator Setting Price:**
```json
{
  "success": false,
  "message": "You must be an approved creator to sell notes.",
  "errors": {
    "price_ngn": ["You must be an approved creator to sell notes."]
  }
}
```

**Validation Error - Price Below Minimum:**
```json
{
  "success": false,
  "message": "Minimum price is 100 NGN.",
  "errors": {
    "price_ngn": ["Minimum price is 100 NGN."]
  }
}
```

**Notes:**
- Slug is auto-generated from title if not provided
- Non-creators cannot set prices (prices forced to 0)
- Only creators (`is_creator = true`) or admins can set prices
- Minimum price is configurable via settings

---

### PUT /api/notes/{id}

Update a note. Requires ownership or admin role.

**Request Body:**
```json
{
  "title": "Updated Note Title",
  "content": "Updated content...",
  "tags": ["updated", "tags"]
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | No | Max 500 chars |
| `content` | string | No | Max 5MB (~5 million chars) |
| `slug` | string | No | Max 500 chars |
| `is_private` | boolean | No | |
| `tags` | array | No | Each tag max 100 chars |
| `price_ngn` | numeric | No | Min 0, max from config |
| `price_usd` | numeric | No | Min 0, max 10000 |
| `status` | string | No | draft or published |
| `thumbnail_url` | url | No | Max 2048 chars |

**Response:**
```json
{
  "success": true,
  "message": "Note updated successfully.",
  "data": {
    "id": 1,
    "title": "Updated Note Title",
    "slug": "updated-note-title",
    "content": "Updated content...",
    "content_preview": "Updated content...",
    "user": {
      "id": 2,
      "name": "Test User",
      "email": "test@example.com",
      "role": "user",
      "is_creator": false,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "created_at": "2026-01-08T03:50:56.000000Z"
    },
    "is_private": false,
    "tags": ["updated", "tags"],
    "price_ngn": "0.00",
    "price_usd": "0.00",
    "is_free": true,
    "is_paid": false,
    "status": "draft",
    "thumbnail_url": null,
    "created_at": "2026-01-10T05:33:43.000000Z",
    "updated_at": "2026-01-10T05:36:06.000000Z"
  }
}
```

**Forbidden (Not Owner):**
```json
{
  "success": false,
  "message": "This action is unauthorized.",
  "errors": null
}
```

**Not Found:**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

**Notes:**
- Uses **ID** for lookup
- Slug is regenerated if title changes
- Non-creators cannot add prices to existing notes

---

### DELETE /api/notes/{id}

Soft delete a note. Requires ownership or admin role.

**Response:**
```json
{
  "success": true,
  "message": "Note deleted successfully.",
  "data": null
}
```

**Forbidden (Not Owner):**
```json
{
  "success": false,
  "message": "You are not authorized to delete this note.",
  "errors": null
}
```

**Not Found:**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

**Notes:**
- Soft-deleted notes are excluded from normal queries
- Soft-deleted notes can be restored by admin
- Owner can include soft-deleted notes in my-notes with `with_trashed=true`

---

### POST /api/notes/{id}/restore

Restore a soft-deleted note. Requires admin role.

**Response:**
```json
{
  "success": true,
  "message": "Note restored successfully.",
  "data": {
    "id": 1,
    "title": "Restored Note",
    "slug": "restored-note",
    "content": "Note content...",
    "status": "draft",
    "created_at": "2026-01-10T05:33:43.000000Z",
    "updated_at": "2026-01-10T05:40:00.000000Z"
  }
}
```

**Forbidden (Not Admin):**
```json
{
  "success": false,
  "message": "Insufficient permissions. This action requires at least admin role."
}
```

**Not Found:**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

---

### POST /api/notes/{id}/publish

Publish a draft note. Requires ownership or admin role.

**Response:**
```json
{
  "success": true,
  "message": "Note published successfully.",
  "data": {
    "id": 1,
    "title": "My Note",
    "slug": "my-note",
    "status": "published",
    "created_at": "2026-01-10T05:33:43.000000Z",
    "updated_at": "2026-01-10T05:35:47.000000Z"
  }
}
```

**Conflict (Already Published):**
```json
{
  "success": false,
  "message": "Note is already published.",
  "errors": null
}
```

**Forbidden (Not Owner):**
```json
{
  "success": false,
  "message": "You are not authorized to publish this note.",
  "errors": null
}
```

---

### POST /api/notes/{id}/unpublish

Unpublish a note (move to draft). Requires ownership or admin role.

**Response:**
```json
{
  "success": true,
  "message": "Note unpublished successfully.",
  "data": {
    "id": 1,
    "title": "My Note",
    "slug": "my-note",
    "status": "draft",
    "created_at": "2026-01-10T05:33:43.000000Z",
    "updated_at": "2026-01-10T05:36:15.000000Z"
  }
}
```

**Conflict (Already Draft):**
```json
{
  "success": false,
  "message": "Note is already a draft.",
  "errors": null
}
```

**Forbidden (Not Owner):**
```json
{
  "success": false,
  "message": "You are not authorized to unpublish this note.",
  "errors": null
}
```

---

### POST /api/notes/{id}/thumbnail

Upload a thumbnail image for a note. Requires ownership or admin role.

**Request:**

Content-Type: `multipart/form-data`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `thumbnail` | file | Yes | Image (jpg, jpeg, png, gif, webp), max 2MB |

**Response:**
```json
{
  "success": true,
  "message": "Thumbnail uploaded successfully.",
  "data": {
    "id": 1,
    "title": "My Note",
    "slug": "my-note",
    "thumbnail_url": "http://localhost:8000/storage/notes/thumbnails/abc123-uuid.jpg",
    "created_at": "2026-01-10T05:33:43.000000Z",
    "updated_at": "2026-01-10T05:40:00.000000Z"
  }
}
```

**Validation Error - Invalid File Type:**
```json
{
  "success": false,
  "message": "Thumbnail must be an image (jpg, jpeg, png, gif, webp).",
  "errors": {
    "thumbnail": ["Thumbnail must be an image (jpg, jpeg, png, gif, webp)."]
  }
}
```

**Validation Error - File Too Large:**
```json
{
  "success": false,
  "message": "Thumbnail cannot exceed 2MB.",
  "errors": {
    "thumbnail": ["Thumbnail cannot exceed 2MB."]
  }
}
```

**Notes:**
- Uploading a new thumbnail replaces the existing one
- Old thumbnail file is deleted from storage

---

### DELETE /api/notes/{id}/thumbnail

Delete a note's thumbnail. Requires ownership or admin role.

**Response:**
```json
{
  "success": true,
  "message": "Thumbnail deleted successfully.",
  "data": {
    "id": 1,
    "title": "My Note",
    "slug": "my-note",
    "thumbnail_url": null,
    "created_at": "2026-01-10T05:33:43.000000Z",
    "updated_at": "2026-01-10T05:45:00.000000Z"
  }
}
```

**Notes:**
- Returns success even if no thumbnail exists

---

## Files

### Authentication

All endpoints require `auth:sanctum` middleware.

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/files` | POST | Yes | Any |

---

### POST /api/files

Upload a content image for embedding in notes.

**Request:**

Content-Type: `multipart/form-data`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `file` | file | Yes | Image (jpg, jpeg, png, gif, webp), max 5MB |

**Response (201 Created):**
```json
{
  "success": true,
  "message": "File uploaded successfully.",
  "data": {
    "id": 1,
    "url": "http://localhost:8000/storage/content-images/2026/01/b319e2b4-9446-4b97-a81b-15a82b5367c0.png",
    "original_name": "diagram.png",
    "mime_type": "image/png",
    "size": 308,
    "created_at": "2026-01-10T13:29:53.000000Z"
  }
}
```

**Validation Error - Missing File:**
```json
{
  "success": false,
  "message": "Please select a file to upload.",
  "errors": {
    "file": ["Please select a file to upload."]
  }
}
```

**Validation Error - Invalid File Type:**
```json
{
  "success": false,
  "message": "File must be an image (jpg, jpeg, png, gif, webp).",
  "errors": {
    "file": ["File must be an image (jpg, jpeg, png, gif, webp)."]
  }
}
```

**Validation Error - File Too Large:**
```json
{
  "success": false,
  "message": "File cannot exceed 5MB.",
  "errors": {
    "file": ["File cannot exceed 5MB."]
  }
}
```

**Notes:**
- Files are stored in `content-images/{year}/{month}/{uuid}.{ext}` structure
- Use the returned URL to embed images in note content
- File records are associated with the uploading user

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

Returned when a user lacks sufficient permissions.

```json
{
  "success": false,
  "message": "You are not authorized to delete this note.",
  "errors": null
}
```

Or for admin-only operations:

```json
{
  "success": false,
  "message": "Insufficient permissions. This action requires at least admin role."
}
```

### 404 Not Found

Returned when the requested resource does not exist.

```json
{
  "success": false,
  "message": "Note not found.",
  "errors": null
}
```

Or generic:

```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

### 409 Conflict

Returned when an action conflicts with the current state.

```json
{
  "success": false,
  "message": "Note is already published.",
  "errors": null
}
```

### 422 Validation Error

Returned when request validation fails.

```json
{
  "success": false,
  "message": "Please provide a note title. (and 1 more error)",
  "errors": {
    "title": ["Please provide a note title."],
    "content": ["Please provide the note content."]
  }
}
```

---

## Data Models

### Note Resource (List/Summary)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique identifier |
| `title` | string | Note title |
| `slug` | string | URL-friendly identifier |
| `content_preview` | string | Truncated content preview |
| `is_private` | boolean | Privacy flag |
| `tags` | array\|null | Array of tag strings |
| `price_ngn` | string | Price in NGN (decimal) |
| `price_usd` | string | Price in USD (decimal) |
| `is_free` | boolean | True if both prices are 0 |
| `is_paid` | boolean | True if any price > 0 |
| `status` | string | draft or published |
| `thumbnail_url` | string\|null | Thumbnail image URL |
| `user` | object | Note creator |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### Note Resource (Full)

Same as summary, plus:

| Field | Type | Description |
|-------|------|-------------|
| `content` | string\|null | Full note content (null for non-owners on paid notes) |

### File Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique identifier |
| `url` | string | Full URL to access the file |
| `original_name` | string | Original filename |
| `mime_type` | string | File MIME type |
| `size` | integer | File size in bytes |
| `created_at` | datetime | ISO 8601 timestamp |

### User Object (Nested)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | User ID |
| `name` | string | User's name |
| `email` | string | User's email |
| `role` | string | User's role |
| `is_creator` | boolean | Creator status |
| `is_verified` | boolean | Email verification status |
| `auth_provider` | string | Authentication provider |
| `avatar_url` | string\|null | Avatar URL |
| `created_at` | datetime | ISO 8601 timestamp |

---

## Notes

### Endpoint Lookup Methods

The Notes resource has different lookup methods for different operations:

| Operation | Lookup By |
|-----------|-----------|
| GET (show) | slug |
| PUT (update) | id |
| DELETE | id |
| POST restore | id |
| POST publish | id |
| POST unpublish | id |
| POST thumbnail | id |
| DELETE thumbnail | id |

### Visibility Rules

| Note Type | Owner | Admin | Other Users |
|-----------|-------|-------|-------------|
| Draft | Full | Full | 404 |
| Private Published | Full | Full | 404 |
| Public Free | Full | Full | Full |
| Public Paid | Full | Full | Preview only (content = null) |

### Creator Pricing Rules

- Only users with `is_creator = true` OR admin role can set prices > 0
- Non-creators can only create free notes
- Minimum NGN price: Configurable via settings (default: 100 NGN)
- Minimum USD price: $0.50
- Maximum NGN price: Configurable via config (default: 100,000 NGN)
- Maximum USD price: $10,000

### Content Limits

| Field | Limit |
|-------|-------|
| `title` | 500 characters |
| `content` | 5MB (~5 million characters) |
| `slug` | 500 characters |
| `tags` (each) | 100 characters |
| `thumbnail_url` | 2048 characters |
| Thumbnail file | 2MB |
| Content image file | 5MB |

### Security

- SQL injection is prevented by Laravel's Eloquent ORM
- XSS content is escaped in JSON responses
- All write operations require authentication
- Owner/Admin authorization enforced on write operations
- File uploads validated for type and size
