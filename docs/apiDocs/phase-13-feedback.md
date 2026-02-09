# Phase 13: Feedback System - API Documentation

## Overview

Phase 13 implements a user feedback system that allows authenticated users to submit free-text feedback (optionally linked to cases or notes), attach files, and track resolution status. Researchers and above can manage feedback status and resolve submissions.

**Key Features:**
- Free-text feedback submission with optional content linking (case/note)
- File attachments via the existing File system
- Status workflow: Pending → Under Review → Resolved
- Role-based access: users see own feedback, researcher+ sees all
- Resolution tracking with resolver identity and timestamp

---

## Table of Contents

1. [Feedback Endpoints](#feedback-endpoints)
2. [Error Responses](#error-responses)
3. [Data Models](#data-models)
4. [Authorization Rules](#authorization-rules)

---

## Feedback Endpoints

### Authentication

All endpoints require `auth:sanctum` middleware.

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/feedback` | GET | Yes | Any |
| `/api/feedback` | POST | Yes | Any (except Guest) |
| `/api/feedback/my-feedback` | GET | Yes | Any |
| `/api/feedback/{uuid}` | GET | Yes | Owner or Researcher+ |
| `/api/feedback/{uuid}/status` | PUT | Yes | Researcher+ |
| `/api/feedback/{uuid}/resolve` | PUT | Yes | Researcher+ |

---

### POST /api/feedback

Submit new feedback with optional content link and file attachments.

**Authorization:** Authenticated user, not Guest role.

**Request Body (JSON or multipart/form-data):**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `feedback_text` | string | Yes | Max 5000 characters |
| `content_type` | string | No | Must be `case` or `note` |
| `content_id` | integer | Required with `content_type` | Must exist in database |
| `attachments` | file[] | No | Max 4 files, each max 5MB |
| `attachments.*` | file | - | mimes: jpg, jpeg, png, gif, webp, pdf, doc, docx |

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/feedback" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"feedback_text": "The search results page could use better filtering options."}'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Feedback submitted successfully.",
  "data": {
    "id": 7,
    "uuid": "6be7a3fe-1853-4bfe-85ba-0839e3e9036d",
    "user": {
      "id": 75,
      "name": "Test User",
      "email": "eden12@example.com",
      "avatar_url": null
    },
    "feedback_text": "The search results page could use better filtering options for case types.",
    "content_type": null,
    "content_id": null,
    "content": null,
    "status": "pending",
    "status_label": "Pending",
    "attachments": [],
    "resolved_by": null,
    "resolved_at": null,
    "moved_to_issues": false,
    "created_at": "2026-02-09T06:11:17+00:00",
    "updated_at": "2026-02-09T06:11:17+00:00"
  }
}
```

**Response (201 Created) - With content link:**
```json
{
  "success": true,
  "message": "Feedback submitted successfully.",
  "data": {
    "id": 8,
    "uuid": "cc774316-ba61-4d1f-912c-3250d596a901",
    "user": {
      "id": 75,
      "name": "Test User",
      "email": "eden12@example.com",
      "avatar_url": null
    },
    "feedback_text": "This case has outdated citation references.",
    "content_type": "case",
    "content_id": 8841,
    "content": {
      "id": 8841,
      "title": "Et omnis magni recusandae tempora et modi modi fugiat.",
      "slug": "et-omnis-magni-recusandae-tempora-et-modi-modi-fugiat",
      "judgment_date": "2003-11-06",
      "citation": null,
      "is_bookmarked": false,
      "bookmarks_count": 0,
      "views_count": 0
    },
    "status": "pending",
    "status_label": "Pending",
    "attachments": [],
    "resolved_by": null,
    "resolved_at": null,
    "moved_to_issues": false,
    "created_at": "2026-02-09T06:11:19+00:00",
    "updated_at": "2026-02-09T06:11:19+00:00"
  }
}
```

**Validation Error (422):**
```json
{
  "success": false,
  "message": "Please provide your feedback.",
  "errors": {
    "feedback_text": ["Please provide your feedback."]
  }
}
```

**Guest User (403 Forbidden):**
```json
{
  "success": false,
  "message": "This action is unauthorized.",
  "errors": null
}
```

**Notes:**
- Attachment limits are configurable via `max_feedback_attachments` (default 4) and `max_attachment_size_mb` (default 5) settings
- `content_id` is ignored when `content_type` is not provided (prevents orphan data)
- Content linking validates that the referenced case/note actually exists

---

### GET /api/feedback

List feedback. Regular users see only their own feedback; researcher+ sees all.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status (`pending`, `under_review`, `resolved`) |
| `content_type` | string | - | Filter by content type (`case`, `note`) |
| `sort` | string | `created_at` | Sort field (`created_at`, `status`, `updated_at`) |
| `direction` | string | `desc` | Sort direction (`asc`, `desc`) |
| `per_page` | integer | `15` | Items per page (1-50) |
| `page` | integer | `1` | Page number |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Feedback retrieved successfully.",
  "data": [
    {
      "id": 8,
      "uuid": "cc774316-ba61-4d1f-912c-3250d596a901",
      "user": {
        "id": 75,
        "name": "Test User",
        "email": "eden12@example.com",
        "avatar_url": null
      },
      "feedback_text": "This case has outdated citation references.",
      "content_type": "case",
      "content_id": 8841,
      "content": {
        "id": 8841,
        "title": "Et omnis magni recusandae tempora et modi modi fugiat.",
        "slug": "et-omnis-magni-recusandae-tempora-et-modi-modi-fugiat",
        "judgment_date": "2003-11-06",
        "citation": null,
        "is_bookmarked": false,
        "bookmarks_count": 0,
        "views_count": 0
      },
      "status": "pending",
      "status_label": "Pending",
      "attachments": [],
      "resolved_by": null,
      "resolved_at": null,
      "moved_to_issues": false,
      "created_at": "2026-02-09T06:11:19+00:00",
      "updated_at": "2026-02-09T06:11:19+00:00"
    },
    {
      "id": 7,
      "uuid": "6be7a3fe-1853-4bfe-85ba-0839e3e9036d",
      "user": {
        "id": 75,
        "name": "Test User",
        "email": "eden12@example.com",
        "avatar_url": null
      },
      "feedback_text": "The search results page could use better filtering options for case types.",
      "content_type": null,
      "content_id": null,
      "content": null,
      "status": "pending",
      "status_label": "Pending",
      "attachments": [],
      "resolved_by": null,
      "resolved_at": null,
      "moved_to_issues": false,
      "created_at": "2026-02-09T06:11:17+00:00",
      "updated_at": "2026-02-09T06:11:17+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 2,
    "total": 8,
    "last_page": 4,
    "from": 1,
    "to": 2
  },
  "links": {
    "first": "http://localhost:8000/api/feedback?page=1",
    "last": "http://localhost:8000/api/feedback?page=4",
    "prev": null,
    "next": "http://localhost:8000/api/feedback?page=2"
  }
}
```

**Notes:**
- Researcher+ sees all feedback with user details eager-loaded
- Regular users see only their own feedback
- `per_page` is clamped between 1 and 50
- Default sort is `created_at` descending (newest first)

---

### GET /api/feedback/my-feedback

List the authenticated user's own feedback. Lighter response than the main listing (no `user` or `resolved_by` relationships).

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `per_page` | integer | `15` | Items per page (1-50) |
| `page` | integer | `1` | Page number |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Feedback retrieved successfully.",
  "data": [
    {
      "id": 8,
      "uuid": "cc774316-ba61-4d1f-912c-3250d596a901",
      "feedback_text": "This case has outdated citation references.",
      "content_type": "case",
      "content_id": 8841,
      "content": {
        "id": 8841,
        "title": "Et omnis magni recusandae tempora et modi modi fugiat.",
        "slug": "et-omnis-magni-recusandae-tempora-et-modi-modi-fugiat",
        "judgment_date": "2003-11-06",
        "citation": null,
        "is_bookmarked": false,
        "bookmarks_count": 0,
        "views_count": 0
      },
      "status": "pending",
      "status_label": "Pending",
      "attachments": [],
      "resolved_at": null,
      "moved_to_issues": false,
      "created_at": "2026-02-09T06:11:19+00:00",
      "updated_at": "2026-02-09T06:11:19+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 2,
    "total": 8,
    "last_page": 4,
    "from": 1,
    "to": 2
  },
  "links": {
    "first": "http://localhost:8000/api/feedback/my-feedback?page=1",
    "last": "http://localhost:8000/api/feedback/my-feedback?page=4",
    "prev": null,
    "next": "http://localhost:8000/api/feedback/my-feedback?page=2"
  }
}
```

**Notes:**
- Always scoped to the authenticated user
- Ordered by newest first
- Does not load `user` or `resolvedBy` relationships (lighter response)

---

### GET /api/feedback/{uuid}

View detailed information about a specific feedback.

**Authorization:** Owner of the feedback or researcher+ role.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Feedback retrieved successfully.",
  "data": {
    "id": 7,
    "uuid": "6be7a3fe-1853-4bfe-85ba-0839e3e9036d",
    "user": {
      "id": 75,
      "name": "Test User",
      "email": "eden12@example.com",
      "avatar_url": null
    },
    "feedback_text": "The search results page could use better filtering options for case types.",
    "content_type": null,
    "content_id": null,
    "content": null,
    "status": "pending",
    "status_label": "Pending",
    "attachments": [],
    "resolved_by": null,
    "resolved_at": null,
    "moved_to_issues": false,
    "created_at": "2026-02-09T06:11:17+00:00",
    "updated_at": "2026-02-09T06:11:17+00:00"
  }
}
```

**Error Response (403 Forbidden) - Non-owner regular user:**
```json
{
  "success": false,
  "message": "You are not authorized to view this feedback.",
  "errors": null
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "message": "No query results for model [App\\Models\\Feedback].",
  "errors": null
}
```

**Notes:**
- Uses UUID-based route model binding (`{feedback:uuid}`)
- Includes all relationships: user, resolvedBy, attachments, content

---

### PUT /api/feedback/{uuid}/status

Update the status of a feedback entry.

**Authorization:** Researcher+ role (enforced via `role:researcher` middleware).

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `status` | string | Yes | Must be `pending`, `under_review`, or `resolved` |

**Example Request:**
```bash
curl -X PUT "http://localhost:8000/api/feedback/{uuid}/status" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"status": "under_review"}'
```

**Response (200 OK) - Status updated to under_review:**
```json
{
  "success": true,
  "message": "Feedback status updated successfully.",
  "data": {
    "id": 7,
    "uuid": "6be7a3fe-1853-4bfe-85ba-0839e3e9036d",
    "user": {
      "id": 75,
      "name": "Test User",
      "email": "eden12@example.com",
      "avatar_url": null
    },
    "feedback_text": "The search results page could use better filtering options for case types.",
    "content_type": null,
    "content_id": null,
    "content": null,
    "status": "under_review",
    "status_label": "Under Review",
    "attachments": [],
    "resolved_by": null,
    "resolved_at": null,
    "moved_to_issues": false,
    "created_at": "2026-02-09T06:11:17+00:00",
    "updated_at": "2026-02-09T06:11:38+00:00"
  }
}
```

**Validation Error (422):**
```json
{
  "success": false,
  "message": "Please provide a status.",
  "errors": {
    "status": ["Please provide a status."]
  }
}
```

**Insufficient Role (403 Forbidden):**
```json
{
  "success": false,
  "message": "Insufficient permissions. This action requires at least researcher role."
}
```

**Notes:**
- Setting status to `resolved` via this endpoint will record `resolved_by` and `resolved_at`
- Moving status away from `resolved` (e.g., back to `pending`) clears `resolved_by` and `resolved_at`
- This endpoint allows any status transition (no strict state machine)

---

### PUT /api/feedback/{uuid}/resolve

Resolve a feedback entry. Shortcut endpoint specifically for resolution.

**Authorization:** Researcher+ role (enforced via `role:researcher` middleware).

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `resolution_notes` | string | No | Max 2000 characters |

**Example Request:**
```bash
curl -X PUT "http://localhost:8000/api/feedback/{uuid}/resolve" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Feedback resolved successfully.",
  "data": {
    "id": 8,
    "uuid": "cc774316-ba61-4d1f-912c-3250d596a901",
    "user": {
      "id": 75,
      "name": "Test User",
      "email": "eden12@example.com",
      "avatar_url": null
    },
    "feedback_text": "This case has outdated citation references.",
    "content_type": "case",
    "content_id": 8841,
    "content": {
      "id": 8841,
      "title": "Et omnis magni recusandae tempora et modi modi fugiat.",
      "slug": "et-omnis-magni-recusandae-tempora-et-modi-modi-fugiat",
      "judgment_date": "2003-11-06",
      "citation": null,
      "is_bookmarked": false,
      "bookmarks_count": 0,
      "views_count": 0
    },
    "status": "resolved",
    "status_label": "Resolved",
    "attachments": [],
    "resolved_by": {
      "id": 76,
      "name": "Test Researcher",
      "email": "alda11@example.org",
      "avatar_url": null
    },
    "resolved_at": "2026-02-09T06:11:40+00:00",
    "moved_to_issues": false,
    "created_at": "2026-02-09T06:11:19+00:00",
    "updated_at": "2026-02-09T06:11:40+00:00"
  }
}
```

**Already Resolved (409 Conflict):**
```json
{
  "success": false,
  "message": "Feedback is already resolved.",
  "errors": null
}
```

**Notes:**
- Returns 409 if feedback is already resolved (use status update endpoint to reopen then re-resolve if needed)
- Records `resolved_by` (acting user) and `resolved_at` (timestamp)

---

## Error Responses

### Common HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created successfully |
| 401 | Unauthenticated |
| 403 | Forbidden - Unauthorized action or insufficient role |
| 404 | Resource not found |
| 409 | Conflict - Already resolved |
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

Returned when the user lacks permission (Guest role or insufficient role).

```json
{
  "success": false,
  "message": "This action is unauthorized.",
  "errors": null
}
```

Or when a researcher+ action is attempted by a regular user:

```json
{
  "success": false,
  "message": "Insufficient permissions. This action requires at least researcher role."
}
```

### 422 Validation Error

Returned when request validation fails.

```json
{
  "success": false,
  "message": "Please provide your feedback.",
  "errors": {
    "feedback_text": ["Please provide your feedback."]
  }
}
```

---

## Data Models

### Feedback Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique identifier |
| `uuid` | string | UUID used in API URLs |
| `user` | object\|null | Submitter (UserSummaryResource, when loaded) |
| `feedback_text` | string | The feedback content |
| `content_type` | string\|null | Linked content type (`case` or `note`) |
| `content_id` | integer\|null | Linked content ID |
| `content` | object\|null | Linked content summary (CaseSummaryResource or NoteSummaryResource) |
| `status` | string | Current status (`pending`, `under_review`, `resolved`) |
| `status_label` | string | Human-readable status (`Pending`, `Under Review`, `Resolved`) |
| `attachments` | array | Array of FileResource objects |
| `resolved_by` | object\|null | Resolver (UserSummaryResource, when loaded) |
| `resolved_at` | datetime\|null | ISO 8601 resolution timestamp |
| `moved_to_issues` | boolean | Whether feedback has been moved to issues |
| `created_at` | datetime | ISO 8601 creation timestamp |
| `updated_at` | datetime | ISO 8601 last update timestamp |

### User Summary Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | User ID |
| `name` | string | User name |
| `email` | string | User email |
| `avatar_url` | string\|null | Avatar URL |

### Feedback Status Values

| Value | Label | Description |
|-------|-------|-------------|
| `pending` | Pending | Newly submitted, awaiting review |
| `under_review` | Under Review | Being reviewed by staff |
| `resolved` | Resolved | Issue has been addressed |

---

## Authorization Rules

### Feedback Submission

| Role | Can Submit |
|------|-----------|
| Guest | No (403) |
| User | Yes |
| Creator | Yes |
| Researcher | Yes |
| Admin | Yes |
| Superadmin | Yes |

### Feedback Viewing

| Action | Owner | Researcher+ | Other Users |
|--------|-------|-------------|-------------|
| List (GET /feedback) | Own only | All | Own only |
| My Feedback | Own | Own | Own |
| Detail (GET /feedback/{uuid}) | Yes | Yes | No (403) |

### Feedback Management

| Action | User | Researcher+ |
|--------|------|-------------|
| Update status | No (403) | Yes |
| Resolve | No (403) | Yes |

---

## Pagination

### Default Values

| Parameter | Default | Maximum |
|-----------|---------|---------|
| `per_page` | 15 | 50 |
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
    "first": "http://localhost:8000/api/feedback?page=1",
    "last": "http://localhost:8000/api/feedback?page=2",
    "prev": null,
    "next": "http://localhost:8000/api/feedback?page=2"
  }
}
```

---

## Notes

1. **UUID Routing:** All feedback detail/action endpoints use UUID (`{feedback:uuid}`) for public-facing URLs instead of auto-increment IDs
2. **Content Linking:** Feedback can optionally be linked to a case or note via polymorphic `content_type`/`content_id` fields. The referenced content is validated to exist on submission
3. **File Attachments:** Attachments are stored via the existing FileService with category `feedback`, disk `s3`, and directory `feedback/{year}/{month}`
4. **Resolution Tracking:** When feedback is resolved (via either endpoint), `resolved_by` and `resolved_at` are set. When status is moved back from resolved, both fields are cleared
5. **Configurable Limits:** Attachment count and file size limits are pulled from the Settings table (`max_feedback_attachments`, `max_attachment_size_mb`)
6. **Allowed Attachment Types:** jpg, jpeg, png, gif, webp, pdf, doc, docx
