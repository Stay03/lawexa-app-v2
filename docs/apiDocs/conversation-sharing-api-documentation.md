# Conversation Sharing - API Documentation

## Overview

This feature allows users to share their AI chat conversations publicly. Conversations are private by default, but users can publish them to make them visible to all authenticated users. Public conversations can be browsed, viewed, and integrated with the trending system for discovery.

---

## Table of Contents

1. [Conversation Visibility Management](#conversation-visibility-management)
2. [Public Conversations](#public-conversations)
3. [Trending Conversations](#trending-conversations)
4. [Error Responses](#error-responses)
5. [Data Models](#data-models)

---

## Conversation Visibility Management

### Authentication

All endpoints require `auth:sanctum` middleware.

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/conversations/{uuid}` | GET | Yes | Owner or Public |
| `/api/conversations/{uuid}/publish` | POST | Yes | Owner |
| `/api/conversations/{uuid}/unpublish` | POST | Yes | Owner |
| `/api/conversations/{uuid}/toggle-visibility` | POST | Yes | Owner |

---

### GET /api/conversations/{uuid}

Get a specific conversation with messages. Owners can view any of their conversations. Non-owners can view public active conversations.

**Response (Owner viewing own conversation):**
```json
{
  "success": true,
  "message": "Conversation retrieved successfully.",
  "data": {
    "id": "a0b8d08c-6094-417f-bbf9-9f9425ec4e73",
    "user_id": 1,
    "agent_id": 1,
    "title": "Hello! What is 2+2?",
    "status": "active",
    "is_private": true,
    "author": {
      "id": 1,
      "name": "John Doe",
      "avatar_url": null
    },
    "agent": {
      "id": 1,
      "model_id": 2,
      "name": "General Assistant",
      "slug": "general-assistant",
      "description": "A helpful general-purpose AI assistant.",
      "temperature": "0.70",
      "max_response_tokens": 2048,
      "is_active": true,
      "created_at": "2026-01-19T15:02:11+00:00",
      "updated_at": "2026-01-19T15:02:11+00:00"
    },
    "messages": [
      {
        "id": 1,
        "conversation_id": "a0b8d08c-6094-417f-bbf9-9f9425ec4e73",
        "agent_id": null,
        "role": "user",
        "content": "Hello! What is 2+2?",
        "metadata": null,
        "created_at": "2026-01-19T15:23:58+00:00"
      },
      {
        "id": 2,
        "conversation_id": "a0b8d08c-6094-417f-bbf9-9f9425ec4e73",
        "agent_id": 1,
        "role": "assistant",
        "content": "The answer to 2 + 2 is 4.",
        "metadata": null,
        "created_at": "2026-01-19T15:24:01+00:00"
      }
    ],
    "messages_count": 2,
    "views_count": 5,
    "created_at": "2026-01-19T15:23:58+00:00",
    "updated_at": "2026-02-02T05:43:38+00:00"
  }
}
```

**Response (Non-owner viewing public conversation):**
```json
{
  "success": true,
  "message": "Conversation retrieved successfully.",
  "data": {
    "id": "a0b8d08c-6094-417f-bbf9-9f9425ec4e73",
    "user_id": 1,
    "agent_id": 1,
    "title": "Hello! What is 2+2?",
    "status": "active",
    "is_private": false,
    "author": {
      "id": 1,
      "name": "John Doe",
      "avatar_url": null
    },
    "agent": {
      "id": 1,
      "name": "General Assistant",
      "slug": "general-assistant"
    },
    "messages": [...],
    "messages_count": 2,
    "views_count": 6,
    "created_at": "2026-01-19T15:23:58+00:00",
    "updated_at": "2026-02-02T05:43:38+00:00"
  }
}
```

**Not Found (Private conversation accessed by non-owner):**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

**Notes:**
- Uses **UUID** for lookup
- Owner can view all their conversations (private, public, active, archived)
- Non-owners can only view public active conversations
- View tracking is enabled for non-owners viewing public conversations
- Views are tracked for trending calculations

---

### POST /api/conversations/{uuid}/publish

Make a private conversation public. Requires ownership.

**Response (Success):**
```json
{
  "success": true,
  "message": "Conversation is now public.",
  "data": {
    "id": "a0b8d08c-6094-417f-bbf9-9f9425ec4e73",
    "user_id": 1,
    "agent_id": 1,
    "title": "Hello! What is 2+2?",
    "status": "active",
    "is_private": false,
    "created_at": "2026-01-19T15:23:58+00:00",
    "updated_at": "2026-02-02T05:43:38+00:00"
  }
}
```

**Response (Already Public):**
```json
{
  "success": true,
  "message": "Conversation is already public.",
  "data": {
    "id": "a0b8d08c-6094-417f-bbf9-9f9425ec4e73",
    "is_private": false,
    ...
  }
}
```

**Not Found (Another user's conversation):**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

---

### POST /api/conversations/{uuid}/unpublish

Make a public conversation private. Requires ownership.

**Response (Success):**
```json
{
  "success": true,
  "message": "Conversation is now private.",
  "data": {
    "id": "a0b8d08c-6094-417f-bbf9-9f9425ec4e73",
    "user_id": 1,
    "agent_id": 1,
    "title": "Hello! What is 2+2?",
    "status": "active",
    "is_private": true,
    "created_at": "2026-01-19T15:23:58+00:00",
    "updated_at": "2026-02-02T05:44:53+00:00"
  }
}
```

**Response (Already Private):**
```json
{
  "success": true,
  "message": "Conversation is already private.",
  "data": {
    "id": "a0b8d08c-6094-417f-bbf9-9f9425ec4e73",
    "is_private": true,
    ...
  }
}
```

**Not Found (Another user's conversation):**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

---

### POST /api/conversations/{uuid}/toggle-visibility

Toggle conversation visibility between public and private. Requires ownership.

**Response (Toggled to Public):**
```json
{
  "success": true,
  "message": "Conversation is now public.",
  "data": {
    "id": "a0b8d08c-6094-417f-bbf9-9f9425ec4e73",
    "is_private": false,
    ...
  }
}
```

**Response (Toggled to Private):**
```json
{
  "success": true,
  "message": "Conversation is now private.",
  "data": {
    "id": "a0b8d08c-6094-417f-bbf9-9f9425ec4e73",
    "is_private": true,
    ...
  }
}
```

---

## Public Conversations

### Authentication

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/shared-conversations` | GET | Yes | Any |

---

### GET /api/shared-conversations

List paginated public active conversations from all users.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sort_by` | string | `created_at` | Sort field (created_at, updated_at, title) |
| `sort_order` | string | `desc` | Sort order (asc, desc) |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Response:**
```json
{
  "success": true,
  "message": "Public conversations retrieved successfully.",
  "data": [
    {
      "id": "a0b8d08c-6094-417f-bbf9-9f9425ec4e73",
      "title": "Hello! What is 2+2?",
      "author": {
        "id": 1,
        "name": "John Doe",
        "avatar_url": null
      },
      "agent": {
        "id": 1,
        "model_id": 2,
        "name": "General Assistant",
        "slug": "general-assistant",
        "description": "A helpful general-purpose AI assistant.",
        "temperature": "0.70",
        "max_response_tokens": 2048,
        "is_active": true,
        "created_at": "2026-01-19T15:02:11+00:00",
        "updated_at": "2026-01-19T15:02:11+00:00"
      },
      "messages_count": 2,
      "views_count": 5,
      "created_at": "2026-01-19T15:23:58+00:00",
      "updated_at": "2026-02-02T05:43:38+00:00"
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
    "first": "http://127.0.0.1:8000/api/shared-conversations?page=1",
    "last": "http://127.0.0.1:8000/api/shared-conversations?page=1",
    "prev": null,
    "next": null
  }
}
```

**Empty Response:**
```json
{
  "success": true,
  "message": "Public conversations retrieved successfully.",
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
    "first": "http://127.0.0.1:8000/api/shared-conversations?page=1",
    "last": "http://127.0.0.1:8000/api/shared-conversations?page=1",
    "prev": null,
    "next": null
  }
}
```

**Notes:**
- Only returns public, active conversations
- Archived and private conversations are excluded
- Includes author information and agent details
- Includes message count and view count

---

## Trending Conversations

### Authentication

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/trending/conversations` | GET | Yes | Any |

---

### GET /api/trending/conversations

Get trending public conversations based on view activity and engagement metrics.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `time_range` | string | `month` | Time range for trending (day, week, month, year, all) |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Response:**
```json
{
  "success": true,
  "message": "Trending conversations retrieved successfully.",
  "data": [
    {
      "id": "a0b8d08c-6094-417f-bbf9-9f9425ec4e73",
      "type": "conversation",
      "title": "Hello! What is 2+2?",
      "author": {
        "id": 1,
        "name": "John Doe",
        "avatar_url": null
      },
      "agent": {
        "id": 1,
        "name": "General Assistant",
        "slug": "general-assistant"
      },
      "created_at": "2026-01-19T15:23:58+00:00",
      "trending_score": 85.5,
      "views_count": 150,
      "unique_viewers": 42,
      "last_viewed_at": "2026-02-02T10:30:00+00:00"
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
    "first": "http://127.0.0.1:8000/api/trending/conversations?page=1",
    "last": "http://127.0.0.1:8000/api/trending/conversations?page=1",
    "prev": null,
    "next": null
  },
  "meta": {
    "filters_applied": {
      "university": null,
      "level": null,
      "country": null,
      "time_range": "month"
    }
  }
}
```

**Notes:**
- Uses the same trending algorithm as cases and notes
- Only public active conversations are included
- Trending score is calculated based on views, unique viewers, and recency
- Results are cached for performance

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

### 404 Not Found

Returned when the requested conversation does not exist or is not accessible.

```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

**This response is returned when:**
- Conversation UUID does not exist
- Private conversation accessed by non-owner
- Archived public conversation accessed by non-owner
- Attempting to publish/unpublish/toggle another user's conversation

---

## Data Models

### Conversation Resource (Full)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier |
| `user_id` | integer | Owner's user ID |
| `agent_id` | integer | AI agent ID |
| `title` | string | Conversation title |
| `status` | string | active or archived |
| `is_private` | boolean | Privacy flag (true = private, false = public) |
| `author` | object | Conversation owner info (when loaded) |
| `agent` | object | AI agent details |
| `messages` | array | Conversation messages (when loaded) |
| `messages_count` | integer | Total message count |
| `views_count` | integer | Total non-bot views |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### Conversation Resource (List/Summary)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier |
| `title` | string | Conversation title |
| `author` | object | Conversation owner info |
| `agent` | object | AI agent details |
| `messages_count` | integer | Total message count |
| `views_count` | integer | Total non-bot views |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### Trending Conversation Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier |
| `type` | string | Always "conversation" |
| `title` | string | Conversation title |
| `author` | object | Conversation owner info |
| `agent` | object | AI agent summary |
| `created_at` | datetime | ISO 8601 timestamp |
| `trending_score` | float | Calculated trending score |
| `views_count` | integer | Total views in time range |
| `unique_viewers` | integer | Unique viewer count |
| `last_viewed_at` | datetime | Last view timestamp |

### Author Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | User ID |
| `name` | string | User's display name |
| `avatar_url` | string\|null | Avatar URL |

### Message Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Message ID |
| `conversation_id` | string (UUID) | Parent conversation UUID |
| `agent_id` | integer\|null | Agent ID (null for user messages) |
| `role` | string | user or assistant |
| `content` | string | Message content |
| `metadata` | object\|null | Additional metadata |
| `created_at` | datetime | ISO 8601 timestamp |

---

## Visibility Rules

| Conversation State | Owner | Other Users |
|--------------------|-------|-------------|
| Private Active | Full access | 404 |
| Private Archived | Full access | 404 |
| Public Active | Full access | Full access (with view tracking) |
| Public Archived | Full access | 404 |

---

## Access Control Summary

| Action | Owner | Other Authenticated Users |
|--------|-------|---------------------------|
| View own conversations | Yes | N/A |
| View public conversation | Yes | Yes |
| View private conversation | Yes | No (404) |
| Publish conversation | Yes | No (404) |
| Unpublish conversation | Yes | No (404) |
| Toggle visibility | Yes | No (404) |
| Archive/Delete | Yes | No (404) |

---

## Integration with Trending

Public conversations are automatically integrated with the trending system:

1. **View Tracking**: When a non-owner views a public conversation, a view is recorded
2. **Trending Score**: Views contribute to the trending score calculation
3. **Discovery**: Trending conversations appear in `/api/trending/conversations`

The trending algorithm considers:
- Total views
- Unique viewers
- Recency of views
- Time decay factor

---

## Security

- All endpoints require authentication
- Owner-only actions return 404 (not 403) to prevent information disclosure
- Private conversations are completely hidden from non-owners
- View tracking excludes bot traffic
- SQL injection prevented by Laravel's Eloquent ORM
