# Phase 14: Content Requests - API Documentation

## Overview

Phase 14 implements a content request system that allows authenticated users to request specific legal content (cases, statutes, provisions) from the research team. Researchers can manage requests through a status workflow, fulfill them by linking to created content, or reject them with a reason. Users receive email notifications when their requests are fulfilled.

**Key Features:**
- Content request submission with type classification (case, statute, provision)
- Status workflow: pending → in_progress → fulfilled/rejected
- Polymorphic content linking when fulfilled (cases, notes)
- Role-based access: users see own requests via `/api/content-requests`, researcher+ manages all via `/api/admin/content-requests`
- Email notifications on fulfillment
- Conflict prevention for completed requests (409)

---

## Table of Contents

1. [Content Request Endpoints](#content-request-endpoints)
2. [Error Responses](#error-responses)
3. [Data Models](#data-models)
4. [Authorization Rules](#authorization-rules)

---

## Content Request Endpoints

### Authentication

All endpoints require `auth:sanctum` middleware.

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/content-requests` | GET | Yes | Any (returns own requests only) |
| `/api/content-requests` | POST | Yes | Any (except Guest) |
| `/api/content-requests/{uuid}` | GET | Yes | Owner or Researcher+ |
| `/api/content-requests/{uuid}/status` | PUT | Yes | Researcher+ |
| `/api/content-requests/{uuid}/fulfill` | PUT | Yes | Researcher+ |
| `/api/content-requests/{uuid}/reject` | PUT | Yes | Researcher+ |
| `/api/admin/content-requests` | GET | Yes | Researcher+ (returns all requests) |

---

### POST /api/content-requests

Submit a new content request.

**Authorization:** Authenticated user, not Guest role.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `type` | string | Yes | Must be `case`, `statute`, or `provision` |
| `title` | string | Yes | Max 255 characters |
| `additional_notes` | string | No | Max 2000 characters |

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/content-requests" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"type": "case", "title": "Need Okonkwo v. State case", "additional_notes": "Supreme Court judgment from 2020"}'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Content request submitted successfully.",
  "data": {
    "id": 1,
    "uuid": "559c838d-278d-47b4-9fcc-89d0e408d361",
    "user": {
      "id": 79,
      "name": "Test User",
      "email": "testuser-cr@test.com",
      "avatar_url": null
    },
    "type": "case",
    "title": "Need Okonkwo v. State case",
    "additional_notes": "Supreme Court judgment from 2020",
    "created_content_type": null,
    "created_content_id": null,
    "created_content": null,
    "status": "pending",
    "status_label": "Pending",
    "fulfilled_by": null,
    "fulfilled_at": null,
    "rejected_by": null,
    "rejected_at": null,
    "rejection_reason": null,
    "created_at": "2026-02-12T01:01:15+00:00",
    "updated_at": "2026-02-12T01:01:15+00:00"
  }
}
```

**Validation Error (422) - Missing Fields:**
```json
{
  "success": false,
  "message": "Please select a content type. (and 1 more error)",
  "errors": {
    "type": ["Please select a content type."],
    "title": ["Please provide a title for your request."]
  }
}
```

**Validation Error (422) - Invalid Type:**
```json
{
  "success": false,
  "message": "Content type must be case, statute, or provision.",
  "errors": {
    "type": ["Content type must be case, statute, or provision."]
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
- Type defaults are extensible for future content types
- `additional_notes` is optional and provides extra context for researchers
- The request starts with `pending` status

---

### GET /api/content-requests

List the authenticated user's own content requests.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status (`pending`, `in_progress`, `fulfilled`, `rejected`) |
| `type` | string | - | Filter by content type (`case`, `statute`, `provision`) |
| `sort` | string | `created_at` | Sort field (`created_at`, `updated_at`) |
| `direction` | string | `desc` | Sort direction (`asc`, `desc`) |
| `per_page` | integer | `15` | Items per page (1-50) |
| `page` | integer | `1` | Page number |

**Example Request:**
```bash
curl "http://localhost:8000/api/content-requests?status=pending&type=case" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Content requests retrieved successfully.",
  "data": [
    {
      "id": 1,
      "uuid": "559c838d-278d-47b4-9fcc-89d0e408d361",
      "user": {
        "id": 79,
        "name": "Test User",
        "email": "testuser-cr@test.com",
        "avatar_url": null
      },
      "type": "case",
      "title": "Need Okonkwo v. State case",
      "additional_notes": "Supreme Court judgment from 2020",
      "created_content_type": null,
      "created_content_id": null,
      "created_content": null,
      "status": "pending",
      "status_label": "Pending",
      "fulfilled_by": null,
      "fulfilled_at": null,
      "rejected_by": null,
      "rejected_at": null,
      "rejection_reason": null,
      "created_at": "2026-02-12T01:01:15+00:00",
      "updated_at": "2026-02-12T01:01:15+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 3,
    "last_page": 1,
    "from": 1,
    "to": 3
  },
  "links": {
    "first": "http://localhost:8000/api/content-requests?page=1",
    "last": "http://localhost:8000/api/content-requests?page=1",
    "prev": null,
    "next": null
  }
}
```

**Notes:**
- Always returns only the authenticated user's own requests, regardless of role
- To view all users' requests, use `GET /api/admin/content-requests` (researcher+ only)
- `per_page` is clamped between 1 and 50
- Default sort is `created_at` descending (newest first)

---

### GET /api/admin/content-requests

List all content requests from all users. Requires researcher+ role.

**Authorization:** Researcher+ role (enforced via `role:researcher` middleware).

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status (`pending`, `in_progress`, `fulfilled`, `rejected`) |
| `type` | string | - | Filter by content type (`case`, `statute`, `provision`) |
| `sort` | string | `created_at` | Sort field (`created_at`, `updated_at`) |
| `direction` | string | `desc` | Sort direction (`asc`, `desc`) |
| `per_page` | integer | `15` | Items per page (1-50) |
| `page` | integer | `1` | Page number |

**Example Request:**
```bash
curl "http://localhost:8000/api/admin/content-requests?status=pending" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Content requests retrieved successfully.",
  "data": [
    {
      "id": 4,
      "uuid": "38a46b8c-d35e-4c6d-9bbd-c268790f869d",
      "user": {
        "id": 68,
        "name": "Regular User",
        "email": "user@example.com",
        "avatar_url": null
      },
      "type": "case",
      "title": "Donoghue v Stevenson [1932] AC 562",
      "additional_notes": "Need the full House of Lords judgment.",
      "created_content_type": null,
      "created_content_id": null,
      "created_content": null,
      "status": "pending",
      "status_label": "Pending",
      "fulfilled_by": null,
      "fulfilled_at": null,
      "rejected_by": null,
      "rejected_at": null,
      "rejection_reason": null,
      "created_at": "2026-02-13T02:37:25+00:00",
      "updated_at": "2026-02-13T02:37:25+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 4,
    "last_page": 1,
    "from": 1,
    "to": 4
  },
  "links": {
    "first": "http://localhost:8000/api/admin/content-requests?page=1",
    "last": "http://localhost:8000/api/admin/content-requests?page=1",
    "prev": null,
    "next": null
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
- Returns all content requests from all users with user details eager-loaded
- Use this endpoint for the admin/researcher dashboard to manage content requests
- Same filtering, sorting, and pagination as `GET /api/content-requests`

---

### GET /api/content-requests/{uuid}

View detailed information about a specific content request.

**Authorization:** Owner of the request or researcher+ role.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Content request retrieved successfully.",
  "data": {
    "id": 1,
    "uuid": "559c838d-278d-47b4-9fcc-89d0e408d361",
    "user": {
      "id": 79,
      "name": "Test User",
      "email": "testuser-cr@test.com",
      "avatar_url": null
    },
    "type": "case",
    "title": "Need Okonkwo v. State case",
    "additional_notes": "Supreme Court judgment from 2020",
    "created_content_type": null,
    "created_content_id": null,
    "created_content": null,
    "status": "pending",
    "status_label": "Pending",
    "fulfilled_by": null,
    "fulfilled_at": null,
    "rejected_by": null,
    "rejected_at": null,
    "rejection_reason": null,
    "created_at": "2026-02-12T01:01:15+00:00",
    "updated_at": "2026-02-12T01:01:15+00:00"
  }
}
```

**Error Response (403 Forbidden) - Non-owner regular user:**
```json
{
  "success": false,
  "message": "You are not authorized to view this content request.",
  "errors": null
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

**Notes:**
- Uses UUID-based route model binding (`{contentRequest:uuid}`)
- Includes all relationships: user, fulfilledBy, rejectedBy, createdContent

---

### PUT /api/content-requests/{uuid}/status

Update the status of a content request.

**Authorization:** Researcher+ role (enforced via `role:researcher` middleware).

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `status` | string | Yes | Must be `pending`, `in_progress`, `fulfilled`, or `rejected` |

**Example Request:**
```bash
curl -X PUT "http://localhost:8000/api/content-requests/{uuid}/status" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"status": "in_progress"}'
```

**Response (200 OK) - Status updated to in_progress:**
```json
{
  "success": true,
  "message": "Content request status updated successfully.",
  "data": {
    "id": 1,
    "uuid": "559c838d-278d-47b4-9fcc-89d0e408d361",
    "user": {
      "id": 79,
      "name": "Test User",
      "email": "testuser-cr@test.com",
      "avatar_url": null
    },
    "type": "case",
    "title": "Need Okonkwo v. State case",
    "additional_notes": "Supreme Court judgment from 2020",
    "created_content_type": null,
    "created_content_id": null,
    "created_content": null,
    "status": "in_progress",
    "status_label": "In Progress",
    "fulfilled_by": null,
    "fulfilled_at": null,
    "rejected_by": null,
    "rejected_at": null,
    "rejection_reason": null,
    "created_at": "2026-02-12T01:01:15+00:00",
    "updated_at": "2026-02-12T01:08:44+00:00"
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

**Invalid Status (422):**
```json
{
  "success": false,
  "message": "Status must be pending, in_progress, fulfilled, or rejected.",
  "errors": {
    "status": ["Status must be pending, in_progress, fulfilled, or rejected."]
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
- Changing status away from `fulfilled` clears `fulfilled_by`, `fulfilled_at`, `created_content_type`, and `created_content_id`
- Changing status away from `rejected` clears `rejected_by`, `rejected_at`, and `rejection_reason`
- This endpoint allows any status transition (no strict state machine)

---

### PUT /api/content-requests/{uuid}/fulfill

Fulfill a content request by linking it to created content.

**Authorization:** Researcher+ role (enforced via `role:researcher` middleware).

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `created_content_type` | string | Yes | Must be `case`, `note`, `statute`, or `provision` |
| `created_content_id` | integer | Yes | Must exist in database for the given type |

**Example Request:**
```bash
curl -X PUT "http://localhost:8000/api/content-requests/{uuid}/fulfill" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"created_content_type": "case", "created_content_id": 1}'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Content request fulfilled successfully.",
  "data": {
    "id": 1,
    "uuid": "559c838d-278d-47b4-9fcc-89d0e408d361",
    "user": {
      "id": 79,
      "name": "Test User",
      "email": "testuser-cr@test.com",
      "avatar_url": null
    },
    "type": "case",
    "title": "Need Okonkwo v. State case",
    "additional_notes": "Supreme Court judgment from 2020",
    "created_content_type": "case",
    "created_content_id": 1,
    "created_content": {
      "id": 1,
      "title": "4 Eng Ltd v Harper & Anor, (2008) 3 WLR 892",
      "slug": "4-eng-ltd-v-harper-anor-2008-3-wlr-892",
      "judgment_date": "2008-04-29",
      "citation": "(2008) 3 WLR 892",
      "is_bookmarked": false,
      "bookmarks_count": 0,
      "views_count": 0
    },
    "status": "fulfilled",
    "status_label": "Fulfilled",
    "fulfilled_by": {
      "id": 80,
      "name": "Test Researcher",
      "email": "testresearcher-cr@test.com",
      "avatar_url": null
    },
    "fulfilled_at": "2026-02-12T01:09:25+00:00",
    "rejected_at": null,
    "rejection_reason": null,
    "created_at": "2026-02-12T01:01:15+00:00",
    "updated_at": "2026-02-12T01:09:25+00:00"
  }
}
```

**Validation Error (422) - Missing Fields:**
```json
{
  "success": false,
  "message": "Please specify the type of content created. (and 1 more error)",
  "errors": {
    "created_content_type": ["Please specify the type of content created."],
    "created_content_id": ["Please provide the ID of the created content."]
  }
}
```

**Validation Error (422) - Non-existent Content:**
```json
{
  "success": false,
  "message": "The specified case does not exist.",
  "errors": {
    "created_content_id": ["The specified case does not exist."]
  }
}
```

**Validation Error (422) - Invalid Content Type:**
```json
{
  "success": false,
  "message": "Content type must be case, note, statute, or provision. (and 1 more error)",
  "errors": {
    "created_content_type": ["Content type must be case, note, statute, or provision."],
    "created_content_id": ["The specified invalid_type does not exist."]
  }
}
```

**Already Completed (409 Conflict) - Already Fulfilled:**
```json
{
  "success": false,
  "message": "Content request is already fulfilled.",
  "errors": null
}
```

**Already Completed (409 Conflict) - Already Rejected:**
```json
{
  "success": false,
  "message": "Content request is already rejected.",
  "errors": null
}
```

**Notes:**
- Returns 409 if the request has already been fulfilled or rejected (use the status update endpoint to reopen first if needed)
- Records `fulfilled_by` (acting researcher) and `fulfilled_at` (timestamp)
- Links polymorphic content via `created_content_type` and `created_content_id`
- Dispatches `ContentRequestFulfilled` event, which triggers an email notification to the requesting user
- Content existence is validated polymorphically (checks the correct model table based on type)

---

### PUT /api/content-requests/{uuid}/reject

Reject a content request with a reason.

**Authorization:** Researcher+ role (enforced via `role:researcher` middleware).

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `rejection_reason` | string | Yes | Max 2000 characters |

**Example Request:**
```bash
curl -X PUT "http://localhost:8000/api/content-requests/{uuid}/reject" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"rejection_reason": "This statute is already available in our database under a different name."}'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Content request rejected successfully.",
  "data": {
    "id": 2,
    "uuid": "a8fd523c-9238-40a6-84a5-6aff855b55ab",
    "user": {
      "id": 79,
      "name": "Test User",
      "email": "testuser-cr@test.com",
      "avatar_url": null
    },
    "type": "statute",
    "title": "Need Companies Act",
    "additional_notes": null,
    "created_content_type": null,
    "created_content_id": null,
    "status": "rejected",
    "status_label": "Rejected",
    "fulfilled_at": null,
    "rejected_by": {
      "id": 80,
      "name": "Test Researcher",
      "email": "testresearcher-cr@test.com",
      "avatar_url": null
    },
    "rejected_at": "2026-02-12T01:10:12+00:00",
    "rejection_reason": "This statute is already available in our database under a different name.",
    "created_at": "2026-02-12T01:01:35+00:00",
    "updated_at": "2026-02-12T01:10:12+00:00"
  }
}
```

**Validation Error (422) - Missing Reason:**
```json
{
  "success": false,
  "message": "Please provide a reason for rejection.",
  "errors": {
    "rejection_reason": ["Please provide a reason for rejection."]
  }
}
```

**Already Completed (409 Conflict) - Already Rejected:**
```json
{
  "success": false,
  "message": "Content request is already rejected.",
  "errors": null
}
```

**Already Completed (409 Conflict) - Already Fulfilled:**
```json
{
  "success": false,
  "message": "Content request is already fulfilled.",
  "errors": null
}
```

**Notes:**
- Returns 409 if the request has already been rejected or fulfilled (use the status update endpoint to reopen first if needed)
- Records `rejected_by` (acting researcher), `rejected_at` (timestamp), and `rejection_reason`
- No email notification is sent on rejection (only fulfillment triggers notification)

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
| 409 | Conflict - Request already fulfilled or rejected |
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

Or when a non-owner tries to view a request:

```json
{
  "success": false,
  "message": "You are not authorized to view this content request.",
  "errors": null
}
```

### 422 Validation Error

Returned when request validation fails.

```json
{
  "success": false,
  "message": "Please select a content type.",
  "errors": {
    "type": ["Please select a content type."]
  }
}
```

---

## Data Models

### Content Request Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique identifier |
| `uuid` | string | UUID used in API URLs |
| `user` | object\|null | Submitter (UserSummaryResource, when loaded) |
| `type` | string | Content type (`case`, `statute`, `provision`) |
| `title` | string | Request title |
| `additional_notes` | string\|null | Additional context for the request |
| `created_content_type` | string\|null | Type of created content when fulfilled (`case`, `note`) |
| `created_content_id` | integer\|null | ID of created content when fulfilled |
| `created_content` | object\|null | Created content summary (CaseSummaryResource or NoteSummaryResource) |
| `status` | string | Current status (`pending`, `in_progress`, `fulfilled`, `rejected`) |
| `status_label` | string | Human-readable status (`Pending`, `In Progress`, `Fulfilled`, `Rejected`) |
| `fulfilled_by` | object\|null | Fulfiller (UserSummaryResource, when loaded) |
| `fulfilled_at` | datetime\|null | ISO 8601 fulfillment timestamp |
| `rejected_by` | object\|null | Rejector (UserSummaryResource, when loaded) |
| `rejected_at` | datetime\|null | ISO 8601 rejection timestamp |
| `rejection_reason` | string\|null | Reason for rejection |
| `created_at` | datetime | ISO 8601 creation timestamp |
| `updated_at` | datetime | ISO 8601 last update timestamp |

### User Summary Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | User ID |
| `name` | string | User name |
| `email` | string | User email |
| `avatar_url` | string\|null | Avatar URL |

### Content Request Status Values

| Value | Label | Description |
|-------|-------|-------------|
| `pending` | Pending | Newly submitted, awaiting review |
| `in_progress` | In Progress | Being worked on by research team |
| `fulfilled` | Fulfilled | Content created and linked |
| `rejected` | Rejected | Request declined with reason |

### Status Workflow

```
pending → in_progress → fulfilled
                     ↘ rejected
```

- **pending**: Initial state when user submits request
- **in_progress**: Researcher starts working on it
- **fulfilled**: Content created and linked, email notification sent
- **rejected**: Request declined with reason provided

---

## Authorization Rules

### Request Submission

| Role | Can Submit |
|------|-----------|
| Guest | No (403) |
| User | Yes |
| Creator | Yes |
| Researcher | Yes |
| Admin | Yes |
| Superadmin | Yes |

### Request Viewing

| Action | Owner | Researcher+ | Other Users |
|--------|-------|-------------|-------------|
| List own (GET /content-requests) | Own only | Own only | Own only |
| List all (GET /admin/content-requests) | No (403) | All | No (403) |
| Detail (GET /content-requests/{uuid}) | Yes | Yes | No (403) |

### Request Management

| Action | User | Researcher+ |
|--------|------|-------------|
| Update status | No (403) | Yes |
| Fulfill | No (403) | Yes |
| Reject | No (403) | Yes |

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
    "first": "http://localhost:8000/api/content-requests?page=1",
    "last": "http://localhost:8000/api/content-requests?page=2",
    "prev": null,
    "next": "http://localhost:8000/api/content-requests?page=2"
  }
}
```

---

## Email Notification

When a content request is fulfilled, the requesting user receives an email with:
- Request title and type
- Fulfiller name
- Fulfillment timestamp
- Created content details (when available)
- Link to view content requests

The email is sent asynchronously via a queued listener (`SendContentRequestFulfilledNotification`) triggered by the `ContentRequestFulfilled` event.

---

## Notes

1. **UUID Routing:** All content request detail/action endpoints use UUID (`{contentRequest:uuid}`) for public-facing URLs instead of auto-increment IDs
2. **Polymorphic Content:** Fulfilled requests link to created content via `created_content_type`/`created_content_id` morph fields. Currently supports `case` (CourtCase) and `note` (Note) models
3. **Conflict Prevention:** Both fulfill and reject endpoints return 409 if the request has already been completed (fulfilled or rejected). Use the status update endpoint to reopen if needed
4. **No Rejection Notification:** Only fulfillment triggers an email notification. Rejected requests do not send emails (can be added in a future phase)
5. **Extensible Types:** The `type` field supports `case`, `statute`, and `provision`. Additional types can be added by updating the validation rules
