# Admin Conversation Management - API Documentation

## Overview

This feature provides superadmin endpoints to view all conversations and their messages for moderation and support purposes. User privacy is preserved by only exposing user UUIDs - no names, emails, or other personal information is included in responses.

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [List All Conversations](#list-all-conversations)
3. [View Conversation with Messages](#view-conversation-with-messages)
4. [Error Responses](#error-responses)
5. [Data Models](#data-models)

---

## Authentication & Authorization

All endpoints require authentication and admin role.

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/admin/conversations` | GET | Yes | Admin |
| `/api/admin/conversations/{uuid}` | GET | Yes | Admin |

**Middleware:** `auth:sanctum`, `role:admin`

---

## List All Conversations

### GET /api/admin/conversations

List all conversations with pagination, filtering, and sorting.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status (`active`, `archived`) |
| `is_private` | boolean | - | Filter by privacy (`true`, `false`) |
| `user_uuid` | string | - | Filter by user UUID |
| `sort_by` | string | `created_at` | Sort field (`created_at`, `updated_at`, `title`) |
| `sort_order` | string | `desc` | Sort order (`asc`, `desc`) |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Example Request:**

```
GET /api/admin/conversations?status=active&is_private=false&per_page=10
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Conversations retrieved successfully.",
  "data": [
    {
      "id": "da9fe307-592a-478c-8a70-75eae9b5c688",
      "user_uuid": "af8085d5-89a9-4e1e-9578-f06c26d37120",
      "title": "find me election cases",
      "status": "active",
      "is_private": true,
      "agent": {
        "id": 3,
        "model_id": null,
        "name": "Lawexa Orchestrator",
        "slug": "lawexa-orchestrator",
        "description": null,
        "temperature": null,
        "max_response_tokens": null,
        "is_active": null,
        "created_at": null,
        "updated_at": null
      },
      "workflow": {
        "id": 7,
        "name": "New Default Workflow",
        "slug": null,
        "description": null,
        "execution_mode": null,
        "orchestrator_agent_id": null,
        "is_default": null,
        "is_active": null,
        "orchestrator_agent": null,
        "created_at": null,
        "updated_at": null
      },
      "messages_count": 14,
      "created_at": "2026-01-20T19:19:21+00:00",
      "updated_at": "2026-01-20T19:19:21+00:00"
    },
    {
      "id": "4d17e231-8451-3f59-be5a-cbb60316c3cf",
      "user_uuid": "6049595e-bc02-4124-8b9d-c4da95603ba8",
      "title": "Assumenda fugit eum reiciendis maiores porro.",
      "status": "active",
      "is_private": true,
      "agent": {
        "id": 8,
        "model_id": null,
        "name": "porro quibusdam sunt Agent",
        "slug": "porro-quibusdam-sunt-agent",
        "description": null,
        "temperature": null,
        "max_response_tokens": null,
        "is_active": null,
        "created_at": null,
        "updated_at": null
      },
      "workflow": null,
      "messages_count": 0,
      "created_at": "2026-01-31T17:15:20+00:00",
      "updated_at": "2026-01-31T17:15:20+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 69,
    "last_page": 5,
    "from": 1,
    "to": 15
  },
  "links": {
    "first": "http://127.0.0.1:8000/api/admin/conversations?page=1",
    "last": "http://127.0.0.1:8000/api/admin/conversations?page=5",
    "prev": null,
    "next": "http://127.0.0.1:8000/api/admin/conversations?page=2"
  }
}
```

**Example: Filter by User UUID:**

```
GET /api/admin/conversations?user_uuid=550e8400-e29b-41d4-a716-446655440000
```

**Example: Filter Archived Private Conversations:**

```
GET /api/admin/conversations?status=archived&is_private=true
```

---

## View Conversation with Messages

### GET /api/admin/conversations/{uuid}

View a specific conversation with all its messages in chronological order.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uuid` | string | Conversation UUID |

**Example Request:**

```
GET /api/admin/conversations/a0b8d08c-6094-417f-bbf9-9f9425ec4e73
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Conversation retrieved successfully.",
  "data": {
    "id": "da9fe307-592a-478c-8a70-75eae9b5c688",
    "user_uuid": "af8085d5-89a9-4e1e-9578-f06c26d37120",
    "title": "find me election cases",
    "status": "active",
    "is_private": true,
    "agent": {
      "id": 3,
      "model_id": 3,
      "name": "Lawexa Orchestrator",
      "slug": "lawexa-orchestrator",
      "description": "The primary AI orchestrator for Lawexa.",
      "temperature": "0.40",
      "max_response_tokens": 4096,
      "is_active": true,
      "created_at": "2026-01-20T09:24:41+00:00",
      "updated_at": "2026-01-20T12:06:49+00:00"
    },
    "workflow": {
      "id": 7,
      "name": "New Default Workflow",
      "slug": "new-default-workflow",
      "description": null,
      "execution_mode": "simple",
      "orchestrator_agent_id": 3,
      "is_default": true,
      "is_active": true,
      "orchestrator_agent": null,
      "created_at": "2026-01-19T21:35:04+00:00",
      "updated_at": "2026-01-20T12:39:11+00:00"
    },
    "messages": [
      {
        "id": 145,
        "agent_id": null,
        "role": "user",
        "content": "find me election cases",
        "metadata": null,
        "created_at": "2026-01-20T19:19:21+00:00"
      },
      {
        "id": 146,
        "agent_id": 3,
        "role": "assistant",
        "content": "{\"tool_call\":\"search_cases\",\"parameters\":{\"query\":\"election\"}}",
        "metadata": {
          "type": "tool_call",
          "tool_name": "search_cases",
          "tool_parameters": {
            "query": "election electoral petition voting ballot",
            "limit": 15
          },
          "iteration": 1
        },
        "created_at": "2026-01-20T19:19:44+00:00"
      },
      {
        "id": 147,
        "agent_id": 3,
        "role": "tool",
        "content": "{\"success\":true,\"message\":\"Cases retrieved successfully.\",\"data\":{\"cases\":[],\"total\":0}}",
        "metadata": {
          "type": "tool_result",
          "tool_name": "search_cases",
          "success": true,
          "latency_ms": 1161,
          "iteration": 1
        },
        "created_at": "2026-01-20T19:19:44+00:00"
      },
      {
        "id": 148,
        "agent_id": 3,
        "role": "assistant",
        "content": "I searched the database for election-related cases but didn't find any results...",
        "metadata": null,
        "created_at": "2026-01-20T19:20:00+00:00"
      }
    ],
    "messages_count": 14,
    "created_at": "2026-01-20T19:19:21+00:00",
    "updated_at": "2026-01-20T19:19:21+00:00"
  }
}
```

**Notes:**
- Messages are returned in chronological order (oldest first)
- User messages have `agent_id: null`
- Assistant messages include the `agent_id` that generated them
- Tool messages have `role: "tool"` with tool execution results
- Metadata may contain tool call info, iteration counts, and latency data

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

Returned when a non-admin user attempts to access admin endpoints.

```json
{
  "success": false,
  "message": "Insufficient permissions. This action requires at least admin role."
}
```

### 404 Not Found

Returned when the requested conversation does not exist.

```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

---

## Data Models

### Admin Conversation Resource (List)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Conversation UUID |
| `user_uuid` | string (UUID) | Owner's UUID (privacy-safe identifier) |
| `title` | string\|null | Conversation title |
| `status` | string | `active` or `archived` |
| `is_private` | boolean | Privacy flag |
| `agent` | object\|null | AI agent object (when loaded) |
| `workflow` | object\|null | Workflow object (when loaded) |
| `messages_count` | integer | Total message count |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### Admin Conversation Resource (Detail)

Same as list, plus:

| Field | Type | Description |
|-------|------|-------------|
| `messages` | array | All messages in chronological order |

### Admin Message Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Message ID |
| `agent_id` | integer\|null | Agent ID (null for user messages) |
| `role` | string | `user`, `assistant`, or `tool` |
| `content` | string | Message content |
| `metadata` | object\|null | Additional metadata (tool info, iteration, latency) |
| `created_at` | datetime | ISO 8601 timestamp |

### Agent Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Agent ID |
| `model_id` | integer\|null | Associated AI model ID |
| `name` | string | Agent name |
| `slug` | string | URL-friendly identifier |
| `description` | string\|null | Agent description |
| `temperature` | string\|null | Temperature setting |
| `max_response_tokens` | integer\|null | Max response token limit |
| `is_active` | boolean\|null | Active status |
| `created_at` | datetime\|null | ISO 8601 timestamp |
| `updated_at` | datetime\|null | ISO 8601 timestamp |

### Workflow Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Workflow ID |
| `name` | string | Workflow name |
| `slug` | string\|null | URL-friendly identifier |
| `description` | string\|null | Workflow description |
| `execution_mode` | string\|null | Execution mode (e.g., `simple`) |
| `orchestrator_agent_id` | integer\|null | Orchestrator agent ID |
| `is_default` | boolean\|null | Default workflow flag |
| `is_active` | boolean\|null | Active status |
| `orchestrator_agent` | object\|null | Nested orchestrator agent |
| `created_at` | datetime\|null | ISO 8601 timestamp |
| `updated_at` | datetime\|null | ISO 8601 timestamp |

---

## Privacy Considerations

| Data Type | Included | Notes |
|-----------|----------|-------|
| User UUID | Yes | Safe anonymous identifier |
| User Name | No | Privacy protected |
| User Email | No | Privacy protected |
| User Avatar | No | Privacy protected |
| Message Content | Yes | Required for moderation |
| Message Metadata | Yes | Contains AI usage info |

**Key Privacy Features:**
- Users are identified only by their UUID
- No personal information (name, email, avatar) is exposed
- Admins can correlate conversations by `user_uuid` without knowing user identity
- For user identity lookup, admins must use separate user management endpoints

---

## Use Cases

### Moderation
- Review flagged or reported conversations
- Identify policy violations in message content
- Track conversation patterns by user UUID

### Support
- Investigate user-reported issues
- Debug AI response quality
- Analyze conversation flow and agent performance

### Analytics
- Count conversations by status and privacy
- Identify high-activity users by UUID
- Monitor conversation trends over time

---

## Access Control Summary

| Action | Admin | Regular User |
|--------|-------|--------------|
| List all conversations | Yes | No (403) |
| View any conversation | Yes | No (403) |
| View conversation messages | Yes | No (403) |
| See user personal info | No | No |
| See user UUID | Yes | N/A |
