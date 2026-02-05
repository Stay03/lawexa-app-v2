# Admin Conversation & User Management - API Documentation

## Overview

This feature provides superadmin endpoints to view all conversations, their messages, and user details for moderation and support purposes. User privacy is preserved by only exposing user UUIDs in conversation listings - no names, emails, or other personal information unless explicitly accessing user detail endpoints.

**Cost Tracking:** All endpoints include usage/cost data aggregated from AI responses, allowing admins to monitor token usage and estimated costs per conversation, per message, and per user.

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [List All Conversations](#list-all-conversations)
3. [View Conversation with Messages](#view-conversation-with-messages)
4. [User Management Endpoints](#user-management-endpoints)
   - [View User Detail](#view-user-detail)
   - [List User Conversations](#list-user-conversations)
   - [User Token Usage Statistics](#user-token-usage-statistics)
5. [Error Responses](#error-responses)
6. [Data Models](#data-models)

---

## Authentication & Authorization

All endpoints require authentication and admin role.

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/admin/conversations` | GET | Yes | Admin |
| `/api/admin/conversations/{uuid}` | GET | Yes | Admin |
| `/api/admin/users/{uuid}` | GET | Yes | Admin |
| `/api/admin/users/{uuid}/conversations` | GET | Yes | Admin |
| `/api/admin/users/{uuid}/token-usage` | GET | Yes | Admin |

**Middleware:** `auth:sanctum`, `role:admin`

---

## List All Conversations

### GET /api/admin/conversations

List all conversations with pagination, filtering, and sorting. Includes aggregated usage/cost data for each conversation.

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
      "usage": {
        "total_cost": 0.000095,
        "total_tokens": 490,
        "prompt_tokens": 442,
        "completion_tokens": 48
      },
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
      "usage": {
        "total_cost": 0,
        "total_tokens": 0,
        "prompt_tokens": 0,
        "completion_tokens": 0
      },
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

View a specific conversation with all its messages in chronological order. Includes aggregated usage/cost data for the conversation and per-message usage data for assistant messages.

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
        "usage": {
          "prompt_tokens": 150,
          "completion_tokens": 50,
          "total_tokens": 200,
          "estimated_cost": 0.00025,
          "latency_ms": 1234
        },
        "created_at": "2026-01-20T19:20:00+00:00"
      }
    ],
    "messages_count": 14,
    "usage": {
      "total_cost": 0.000095,
      "total_tokens": 490,
      "prompt_tokens": 442,
      "completion_tokens": 48
    },
    "created_at": "2026-01-20T19:19:21+00:00",
    "updated_at": "2026-01-20T19:19:21+00:00"
  }
}
```

**Notes:**
- Messages are returned in chronological order (oldest first)
- User messages have `agent_id: null` and no `usage` field
- Assistant messages include the `agent_id` that generated them
- Assistant messages may include `usage` with per-message cost/token data (when linked to an AI response)
- Tool messages have `role: "tool"` with tool execution results
- Metadata may contain tool call info, iteration counts, and latency data
- The conversation-level `usage` aggregates costs from all AI requests in the conversation

---

## User Management Endpoints

### View User Detail

#### GET /api/admin/users/{uuid}

View detailed user information including profile, usage summary, and statistics.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uuid` | string | User UUID |

**Example Request:**

```
GET /api/admin/users/a5b3e808-a3ad-4c1f-b1e7-d3af87d11536
```

**Response (Success):**

```json
{
  "success": true,
  "message": "User retrieved successfully.",
  "data": {
    "id": 2,
    "uuid": "a5b3e808-a3ad-4c1f-b1e7-d3af87d11536",
    "name": "Test User Updated",
    "email": "test@example.com",
    "role": "user",
    "is_creator": false,
    "is_verified": true,
    "auth_provider": "email",
    "avatar_url": null,
    "profile": {
      "id": 10,
      "gender": null,
      "date_of_birth": null,
      "address": null,
      "profession": "Lawyer",
      "area_of_study": null,
      "country": "Nigeria",
      "city": "Lagos",
      "state": "Lagos",
      "law_school": "Nigerian Law School",
      "university": "University of Lagos",
      "level": "Senior Associate",
      "call_to_bar_year": null,
      "call_number": null,
      "other_certifications": null,
      "work_experience": null,
      "bio": "Experienced corporate lawyer",
      "communication_style": null,
      "linkedin_url": null,
      "website_url": null,
      "twitter_url": null,
      "facebook_url": null
    },
    "areas_of_expertise": [
      {
        "id": 3,
        "name": "Family Law",
        "slug": "family-law"
      }
    ],
    "conversations_count": 6,
    "usage_summary": {
      "total_conversations": 6,
      "prompt_tokens": 3968,
      "completion_tokens": 730,
      "total_tokens": 4698,
      "total_cost": 0.022854,
      "total_requests": 3
    },
    "created_at": "2026-01-16T00:28:33+00:00",
    "updated_at": "2026-01-24T14:19:58+00:00"
  }
}
```

**Notes:**
- Returns full user profile including location (city, state, country), education (law school, university, level)
- Includes aggregated usage summary with total tokens and cost
- Shows conversation count for the user
- Exposes user personal information (name, email) - this is an admin-only endpoint

---

### List User Conversations

#### GET /api/admin/users/{uuid}/conversations

List all conversations for a specific user with pagination and filtering.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uuid` | string | User UUID |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status (`active`, `archived`) |
| `sort_by` | string | `created_at` | Sort field (`created_at`, `updated_at`, `title`) |
| `sort_order` | string | `desc` | Sort order (`asc`, `desc`) |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Example Request:**

```
GET /api/admin/users/a5b3e808-a3ad-4c1f-b1e7-d3af87d11536/conversations?per_page=5
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Conversations retrieved successfully.",
  "data": [
    {
      "id": "41c62720-90ce-4c65-a029-0e87e68684d7",
      "user_uuid": "a5b3e808-a3ad-4c1f-b1e7-d3af87d11536",
      "title": "hi",
      "status": "active",
      "is_private": true,
      "agent": {
        "id": 3,
        "name": "Lawexa Orchestrator",
        "slug": "lawexa-orchestrator"
      },
      "workflow": {
        "id": 7,
        "name": "New Default Workflow"
      },
      "messages_count": 2,
      "usage": {
        "total_cost": 0.006099,
        "total_tokens": 1461,
        "prompt_tokens": 1318,
        "completion_tokens": 143
      },
      "created_at": "2026-01-20T23:24:56+00:00",
      "updated_at": "2026-01-20T23:24:56+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 5,
    "total": 6,
    "last_page": 2,
    "from": 1,
    "to": 5
  },
  "links": {
    "first": "http://localhost:8000/api/admin/users/a5b3e808-a3ad-4c1f-b1e7-d3af87d11536/conversations?page=1",
    "last": "http://localhost:8000/api/admin/users/a5b3e808-a3ad-4c1f-b1e7-d3af87d11536/conversations?page=2",
    "prev": null,
    "next": "http://localhost:8000/api/admin/users/a5b3e808-a3ad-4c1f-b1e7-d3af87d11536/conversations?page=2"
  }
}
```

**Notes:**
- Returns the same conversation format as `/api/admin/conversations` but filtered to one user
- Includes usage stats per conversation
- Supports all the same filtering and sorting options

---

### User Token Usage Statistics

#### GET /api/admin/users/{uuid}/token-usage

Get detailed token usage statistics for a user with various filtering, grouping, and sorting options.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uuid` | string | User UUID |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `start_date` | date | - | Filter from date (Y-m-d format) |
| `end_date` | date | - | Filter to date (Y-m-d format) |
| `agent_slug` | string | - | Filter by AI agent slug |
| `group_by` | string | `none` | Group by: `none`, `day`, `week`, `month`, `agent`, `conversation` |
| `sort_by` | string | `created_at` | Sort field: `created_at`, `total_tokens`, `estimated_cost` |
| `sort_order` | string | `desc` | Sort order: `asc`, `desc` |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Example Request (Ungrouped - Raw Records):**

```
GET /api/admin/users/a5b3e808-a3ad-4c1f-b1e7-d3af87d11536/token-usage?group_by=none&per_page=3
```

**Response (Ungrouped):**

```json
{
  "success": true,
  "message": "Token usage retrieved successfully.",
  "data": {
    "summary": {
      "prompt_tokens": 3968,
      "completion_tokens": 730,
      "total_tokens": 4698,
      "total_cost": 0.022854,
      "total_requests": 3
    },
    "breakdown": [
      {
        "id": 53,
        "conversation": {
          "uuid": "41c62720-90ce-4c65-a029-0e87e68684d7",
          "title": "hi"
        },
        "agent": {
          "name": "Lawexa Orchestrator",
          "slug": "lawexa-orchestrator"
        },
        "prompt_tokens": 1318,
        "completion_tokens": 143,
        "total_tokens": 1461,
        "estimated_cost": 0.006099,
        "latency_ms": 5342,
        "created_at": "2026-01-20T23:25:05+00:00"
      }
    ]
  },
  "pagination": {
    "current_page": 1,
    "per_page": 3,
    "total": 3,
    "last_page": 1,
    "from": 1,
    "to": 3
  }
}
```

**Example Request (Grouped by Day):**

```
GET /api/admin/users/a5b3e808-a3ad-4c1f-b1e7-d3af87d11536/token-usage?group_by=day
```

**Response (Grouped by Day):**

```json
{
  "success": true,
  "message": "Token usage retrieved successfully.",
  "data": {
    "summary": {
      "prompt_tokens": 3968,
      "completion_tokens": 730,
      "total_tokens": 4698,
      "total_cost": 0.022854,
      "total_requests": 3
    },
    "breakdown": [
      {
        "period": "2026-01-20",
        "prompt_tokens": 3968,
        "completion_tokens": 730,
        "total_tokens": 4698,
        "estimated_cost": "0.022854",
        "request_count": 3
      }
    ]
  },
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 1,
    "last_page": 1,
    "from": 1,
    "to": 1
  }
}
```

**Example Request (Grouped by Agent):**

```
GET /api/admin/users/a5b3e808-a3ad-4c1f-b1e7-d3af87d11536/token-usage?group_by=agent
```

**Response (Grouped by Agent):**

```json
{
  "success": true,
  "message": "Token usage retrieved successfully.",
  "data": {
    "summary": {
      "prompt_tokens": 3968,
      "completion_tokens": 730,
      "total_tokens": 4698,
      "total_cost": 0.022854,
      "total_requests": 3
    },
    "breakdown": [
      {
        "agent_id": 3,
        "agent_name": "Lawexa Orchestrator",
        "agent_slug": "lawexa-orchestrator",
        "prompt_tokens": 3968,
        "completion_tokens": 730,
        "total_tokens": 4698,
        "estimated_cost": "0.022854",
        "request_count": 3
      }
    ]
  }
}
```

**Example Request (Grouped by Conversation with Sorting):**

```
GET /api/admin/users/a5b3e808-a3ad-4c1f-b1e7-d3af87d11536/token-usage?group_by=conversation&sort_by=total_tokens&sort_order=desc
```

**Response (Grouped by Conversation):**

```json
{
  "success": true,
  "message": "Token usage retrieved successfully.",
  "data": {
    "summary": {
      "prompt_tokens": 3968,
      "completion_tokens": 730,
      "total_tokens": 4698,
      "total_cost": 0.022854,
      "total_requests": 3
    },
    "breakdown": [
      {
        "conversation_uuid": "b77fc828-5ab9-4458-a806-fa76418bc59f",
        "conversation_title": "Hello, what can you do?",
        "prompt_tokens": 1324,
        "completion_tokens": 328,
        "total_tokens": 1652,
        "estimated_cost": "0.008892",
        "request_count": 1
      }
    ]
  }
}
```

**Grouping Options:**

| Value | Description | Output Fields |
|-------|-------------|---------------|
| `none` | Individual AI response records | `id`, `conversation`, `agent`, tokens, `latency_ms`, `created_at` |
| `day` | Aggregate by calendar day | `period` (YYYY-MM-DD), tokens, `request_count` |
| `week` | Aggregate by week | `period` (YYYYWW), `week_start`, tokens, `request_count` |
| `month` | Aggregate by month | `period` (YYYY-MM), tokens, `request_count` |
| `agent` | Aggregate by AI agent | `agent_id`, `agent_name`, `agent_slug`, tokens, `request_count` |
| `conversation` | Aggregate by conversation | `conversation_uuid`, `conversation_title`, tokens, `request_count` |

**Notes:**
- Summary totals are always included regardless of grouping
- When `group_by=none`, returns individual AI response records with conversation and agent context
- Date filtering works with all grouping options
- Agent filtering works with all grouping options
- Sorting applies to the breakdown results (not the summary)

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
| `usage` | object | Aggregated usage/cost data |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### Admin Conversation Resource (Detail)

Same as list, plus:

| Field | Type | Description |
|-------|------|-------------|
| `messages` | array | All messages in chronological order |

### Conversation Usage Object

| Field | Type | Description |
|-------|------|-------------|
| `total_cost` | float | Total estimated cost in USD |
| `total_tokens` | integer | Total tokens used (prompt + completion) |
| `prompt_tokens` | integer | Total input/prompt tokens |
| `completion_tokens` | integer | Total output/completion tokens |

### Admin Message Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Message ID |
| `agent_id` | integer\|null | Agent ID (null for user messages) |
| `role` | string | `user`, `assistant`, or `tool` |
| `content` | string | Message content |
| `metadata` | object\|null | Additional metadata (tool info, iteration, latency) |
| `usage` | object\|null | Per-message usage data (assistant messages only, when linked) |
| `created_at` | datetime | ISO 8601 timestamp |

### Message Usage Object

| Field | Type | Description |
|-------|------|-------------|
| `prompt_tokens` | integer | Input/prompt tokens for this message |
| `completion_tokens` | integer | Output/completion tokens for this message |
| `total_tokens` | integer | Total tokens for this message |
| `estimated_cost` | float | Estimated cost in USD |
| `latency_ms` | integer | Response latency in milliseconds |

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

### Admin User Detail Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | User ID |
| `uuid` | string (UUID) | User UUID |
| `name` | string | User full name |
| `email` | string | User email address |
| `role` | string | User role (e.g., `user`, `admin`) |
| `is_creator` | boolean | Creator status flag |
| `is_verified` | boolean | Email verification status |
| `auth_provider` | string | Auth provider (e.g., `email`, `google`) |
| `avatar_url` | string\|null | Avatar image URL |
| `profile` | object\|null | User profile object |
| `areas_of_expertise` | array | Array of expertise areas |
| `conversations_count` | integer | Total conversations created |
| `usage_summary` | object | Aggregated token usage summary |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### User Profile Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Profile ID |
| `gender` | string\|null | Gender |
| `date_of_birth` | date\|null | Date of birth (Y-m-d) |
| `address` | string\|null | Physical address |
| `profession` | string\|null | Professional title |
| `area_of_study` | string\|null | Field of study |
| `country` | string\|null | Country |
| `city` | string\|null | City |
| `state` | string\|null | State/Province |
| `law_school` | string\|null | Law school name |
| `university` | string\|null | University name |
| `level` | string\|null | Professional level |
| `call_to_bar_year` | integer\|null | Year called to bar |
| `call_number` | string\|null | Bar call number |
| `other_certifications` | string\|null | Additional certifications |
| `work_experience` | string\|null | Work experience details |
| `bio` | string\|null | Biography |
| `communication_style` | string\|null | Preferred communication style |
| `linkedin_url` | string\|null | LinkedIn profile URL |
| `website_url` | string\|null | Personal/professional website |
| `twitter_url` | string\|null | Twitter profile URL |
| `facebook_url` | string\|null | Facebook profile URL |

### User Usage Summary Object

| Field | Type | Description |
|-------|------|-------------|
| `total_conversations` | integer | Total conversations created by user |
| `prompt_tokens` | integer | Total input/prompt tokens used |
| `completion_tokens` | integer | Total output/completion tokens used |
| `total_tokens` | integer | Total tokens used (prompt + completion) |
| `total_cost` | float | Total estimated cost in USD |
| `total_requests` | integer | Total AI requests made |

### User Token Usage Resource (Ungrouped)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | AI response ID |
| `conversation` | object | Conversation UUID and title |
| `agent` | object | Agent name and slug |
| `prompt_tokens` | integer | Input tokens |
| `completion_tokens` | integer | Output tokens |
| `total_tokens` | integer | Total tokens |
| `estimated_cost` | float | Estimated cost in USD |
| `latency_ms` | integer | Response latency in milliseconds |
| `created_at` | datetime | ISO 8601 timestamp |

### User Token Usage Resource (Grouped by Day/Week/Month)

| Field | Type | Description |
|-------|------|-------------|
| `period` | string | Date period (YYYY-MM-DD, YYYYWW, or YYYY-MM) |
| `week_start` | date | Week start date (week grouping only) |
| `prompt_tokens` | integer | Aggregated input tokens |
| `completion_tokens` | integer | Aggregated output tokens |
| `total_tokens` | integer | Aggregated total tokens |
| `estimated_cost` | string | Aggregated cost |
| `request_count` | integer | Number of requests in period |

### User Token Usage Resource (Grouped by Agent)

| Field | Type | Description |
|-------|------|-------------|
| `agent_id` | integer | Agent ID |
| `agent_name` | string | Agent name |
| `agent_slug` | string | Agent slug |
| `prompt_tokens` | integer | Aggregated input tokens |
| `completion_tokens` | integer | Aggregated output tokens |
| `total_tokens` | integer | Aggregated total tokens |
| `estimated_cost` | string | Aggregated cost |
| `request_count` | integer | Number of requests for this agent |

### User Token Usage Resource (Grouped by Conversation)

| Field | Type | Description |
|-------|------|-------------|
| `conversation_uuid` | string (UUID) | Conversation UUID |
| `conversation_title` | string | Conversation title |
| `prompt_tokens` | integer | Aggregated input tokens |
| `completion_tokens` | integer | Aggregated output tokens |
| `total_tokens` | integer | Aggregated total tokens |
| `estimated_cost` | string | Aggregated cost |
| `request_count` | integer | Number of requests in conversation |

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
| Usage/Cost Data | Yes | Token counts and estimated costs |

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
- View full user profiles when investigating reports

### Support
- Investigate user-reported issues
- Debug AI response quality
- Analyze conversation flow and agent performance
- View user details to understand context
- Access user's location and education info for better support

### Analytics & Cost Monitoring
- Count conversations by status and privacy
- Identify high-activity users by UUID
- Monitor conversation trends over time
- Track token usage and costs per conversation
- Identify expensive conversations or users
- Monitor AI spending patterns
- Analyze token usage by day, week, month, agent, or conversation
- Filter usage by date ranges or specific agents
- Track per-user spending and usage patterns

### User Management
- View user profile details including location and education
- Monitor user's conversation activity
- Track individual user's token consumption
- Analyze usage patterns across different time periods
- Identify users with unusual usage patterns

---

## Access Control Summary

| Action | Admin | Regular User |
|--------|-------|--------------|
| List all conversations | Yes | No (403) |
| View any conversation | Yes | No (403) |
| View conversation messages | Yes | No (403) |
| View usage/cost data | Yes | No (403) |
| View user detail | Yes | No (403) |
| See user personal info | Yes (via user detail endpoint) | No |
| See user profile (location, education) | Yes (via user detail endpoint) | No |
| List user's conversations | Yes | No (403) |
| View user token usage stats | Yes | No (403) |
| See user UUID | Yes | N/A |

**Privacy Note:** While conversation endpoints only expose user UUIDs, the user detail endpoints (`/api/admin/users/{uuid}`) intentionally expose full user information including name, email, profile data, and usage statistics. This is necessary for proper user support and management but should be accessed responsibly.
