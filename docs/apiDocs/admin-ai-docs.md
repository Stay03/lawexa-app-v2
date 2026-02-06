# Admin AI Management - API Documentation

## Overview

This feature provides superadmin endpoints to manage the AI infrastructure: providers, models, agents, tools, and workflows. These endpoints enable full CRUD operations for configuring the AI pipeline that powers conversations.

**Dependency Chain:** Providers → Models → Agents → Tools (attach to Agents) / Workflows (contain Agents)

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [AI Providers](#ai-providers)
   - [List All Providers](#list-all-providers)
   - [Create Provider](#create-provider)
   - [View Provider](#view-provider)
   - [Update Provider](#update-provider)
   - [Delete Provider](#delete-provider)
   - [Test Provider API Key](#test-provider-api-key)
3. [AI Models](#ai-models)
   - [List All Models](#list-all-models)
   - [Create Model](#create-model)
   - [View Model](#view-model)
   - [Update Model](#update-model)
   - [Delete Model](#delete-model)
4. [AI Agents](#ai-agents)
   - [List All Agents](#list-all-agents)
   - [Create Agent](#create-agent)
   - [View Agent](#view-agent)
   - [Update Agent](#update-agent)
   - [Delete Agent](#delete-agent)
5. [AI Tools](#ai-tools)
   - [List All Tools](#list-all-tools)
   - [Create Tool](#create-tool)
   - [View Tool](#view-tool)
   - [Update Tool](#update-tool)
   - [Delete Tool](#delete-tool)
   - [Attach Tool to Agent](#attach-tool-to-agent)
   - [Detach Tool from Agent](#detach-tool-from-agent)
6. [AI Workflows](#ai-workflows)
   - [List All Workflows](#list-all-workflows)
   - [Create Workflow](#create-workflow)
   - [View Workflow](#view-workflow)
   - [Update Workflow](#update-workflow)
   - [Delete Workflow](#delete-workflow)
7. [Error Responses](#error-responses)
8. [Data Models](#data-models)
9. [Enums](#enums)

---

## Authentication & Authorization

All endpoints require authentication and admin role.

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/admin/ai-providers` | GET | Yes | Admin |
| `/api/admin/ai-providers` | POST | Yes | Admin |
| `/api/admin/ai-providers/{id}` | GET | Yes | Admin |
| `/api/admin/ai-providers/{id}` | PUT | Yes | Admin |
| `/api/admin/ai-providers/{id}` | DELETE | Yes | Admin |
| `/api/admin/ai-providers/{id}/test` | POST | Yes | Admin |
| `/api/admin/ai-models` | GET | Yes | Admin |
| `/api/admin/ai-models` | POST | Yes | Admin |
| `/api/admin/ai-models/{id}` | GET | Yes | Admin |
| `/api/admin/ai-models/{id}` | PUT | Yes | Admin |
| `/api/admin/ai-models/{id}` | DELETE | Yes | Admin |
| `/api/admin/ai-agents` | GET | Yes | Admin |
| `/api/admin/ai-agents` | POST | Yes | Admin |
| `/api/admin/ai-agents/{id}` | GET | Yes | Admin |
| `/api/admin/ai-agents/{id}` | PUT | Yes | Admin |
| `/api/admin/ai-agents/{id}` | DELETE | Yes | Admin |
| `/api/admin/ai-tools` | GET | Yes | Admin |
| `/api/admin/ai-tools` | POST | Yes | Admin |
| `/api/admin/ai-tools/{id}` | GET | Yes | Admin |
| `/api/admin/ai-tools/{id}` | PUT | Yes | Admin |
| `/api/admin/ai-tools/{id}` | DELETE | Yes | Admin |
| `/api/admin/ai-tools/{id}/agents/{agentId}` | POST | Yes | Admin |
| `/api/admin/ai-tools/{id}/agents/{agentId}` | DELETE | Yes | Admin |
| `/api/admin/ai-workflows` | GET | Yes | Admin |
| `/api/admin/ai-workflows` | POST | Yes | Admin |
| `/api/admin/ai-workflows/{id}` | GET | Yes | Admin |
| `/api/admin/ai-workflows/{id}` | PUT | Yes | Admin |
| `/api/admin/ai-workflows/{id}` | DELETE | Yes | Admin |

**Middleware:** `auth:sanctum`, `role:admin`

---

## AI Providers

### List All Providers

#### GET /api/admin/ai-providers

List all AI providers with pagination, filtering, and sorting.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `active_only` | boolean | - | Filter active providers only |
| `sort_by` | string | `name` | Sort field (`name`, `created_at`) |
| `sort_order` | string | `asc` | Sort order (`asc`, `desc`) |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Example Request:**

```
GET /api/admin/ai-providers?active_only=1&sort_by=name&sort_order=asc&per_page=3&page=1
```

**Response (Success):**

```json
{
  "success": true,
  "message": "AI providers retrieved successfully.",
  "data": [
    {
      "id": 6,
      "name": "Bins, Krajcik and Pfeffer AI",
      "slug": "bins-krajcik-and-pfeffer-ai",
      "base_url": "https://api.example.com/v1",
      "is_active": true,
      "models_count": 1,
      "created_at": "2026-01-21T14:34:27+00:00",
      "updated_at": "2026-01-21T14:34:27+00:00"
    },
    {
      "id": 9,
      "name": "Douglas LLC AI",
      "slug": "douglas-llc-ai",
      "base_url": "https://api.example.com/v1",
      "is_active": true,
      "models_count": 1,
      "created_at": "2026-01-31T17:15:19+00:00",
      "updated_at": "2026-01-31T17:15:19+00:00"
    },
    {
      "id": 11,
      "name": "Grady, Stokes and Bode AI",
      "slug": "grady-stokes-and-bode-ai",
      "base_url": "https://api.example.com/v1",
      "is_active": true,
      "models_count": 1,
      "created_at": "2026-01-31T17:15:20+00:00",
      "updated_at": "2026-01-31T17:15:20+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 3,
    "total": 11,
    "last_page": 4,
    "from": 1,
    "to": 3
  },
  "links": {
    "first": "http://127.0.0.1:8000/api/admin/ai-providers?page=1",
    "last": "http://127.0.0.1:8000/api/admin/ai-providers?page=4",
    "prev": null,
    "next": "http://127.0.0.1:8000/api/admin/ai-providers?page=2"
  }
}
```

**Notes:**
- The `api_key` field is never exposed in responses (hidden on the model)
- `models_count` shows the number of AI models associated with the provider
- The `models` relationship is NOT loaded on the list endpoint (only on show)

---

### Create Provider

#### POST /api/admin/ai-providers

Create a new AI provider.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Provider name (max 255) |
| `slug` | string | Yes | URL-friendly identifier (max 100, alpha_dash, unique) |
| `base_url` | string | Yes | API base URL (valid URL, max 500) |
| `api_key` | string | Yes | API key (encrypted at rest) |
| `is_active` | boolean | No | Active status (default: true) |

**Example Request:**

```json
POST /api/admin/ai-providers

{
  "name": "Test Provider",
  "slug": "test-provider",
  "base_url": "https://api.test-provider.com/v1",
  "api_key": "sk-test-key-12345",
  "is_active": true
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "AI provider created successfully.",
  "data": {
    "id": 12,
    "name": "Test Provider",
    "slug": "test-provider",
    "base_url": "https://api.test-provider.com/v1",
    "is_active": true,
    "created_at": "2026-02-06T21:36:54+00:00",
    "updated_at": "2026-02-06T21:36:54+00:00"
  }
}
```

**Validation Error (Missing Fields):**

```json
{
  "success": false,
  "message": "Provider name is required. (and 3 more errors)",
  "errors": {
    "name": ["Provider name is required."],
    "slug": ["Provider slug is required."],
    "base_url": ["Base URL is required."],
    "api_key": ["API key is required."]
  }
}
```

**Validation Error (Duplicate Slug):**

```json
{
  "success": false,
  "message": "This slug is already in use.",
  "errors": {
    "slug": ["This slug is already in use."]
  }
}
```

**Validation Error (Invalid URL):**

```json
{
  "success": false,
  "message": "Base URL must be a valid URL.",
  "errors": {
    "base_url": ["Base URL must be a valid URL."]
  }
}
```

---

### View Provider

#### GET /api/admin/ai-providers/{id}

View a specific provider with all its models.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Provider ID |

**Example Request:**

```
GET /api/admin/ai-providers/1
```

**Response (Success):**

```json
{
  "success": true,
  "message": "AI provider retrieved successfully.",
  "data": {
    "id": 1,
    "name": "OpenRouter",
    "slug": "openrouter",
    "base_url": "https://openrouter.ai/api/v1",
    "is_active": true,
    "models_count": 7,
    "models": [
      {
        "id": 4,
        "provider_id": 1,
        "name": "Claude 3 Haiku",
        "model_id": "anthropic/claude-3-haiku",
        "input_price_per_1m": "0.2500",
        "output_price_per_1m": "1.2500",
        "max_context_tokens": 200000,
        "supports_vision": true,
        "supports_streaming": true,
        "created_at": "2026-01-19T04:25:31+00:00",
        "updated_at": "2026-01-19T04:25:31+00:00"
      },
      {
        "id": 1,
        "provider_id": 1,
        "name": "GPT-4o",
        "model_id": "openai/gpt-4o",
        "input_price_per_1m": "2.5000",
        "output_price_per_1m": "10.0000",
        "max_context_tokens": 128000,
        "supports_vision": true,
        "supports_streaming": true,
        "created_at": "2026-01-19T04:25:31+00:00",
        "updated_at": "2026-01-19T04:25:31+00:00"
      }
    ],
    "created_at": "2026-01-19T04:25:31+00:00",
    "updated_at": "2026-01-20T22:58:46+00:00"
  }
}
```

**Notes:**
- The show endpoint loads the `models` relationship (list does not)
- Includes `models_count` for quick reference

---

### Update Provider

#### PUT /api/admin/ai-providers/{id}

Update a provider. All fields are optional (partial update).

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Provider name |
| `slug` | string | No | URL-friendly identifier (unique, excluding current) |
| `base_url` | string | No | API base URL (valid URL) |
| `api_key` | string | No | API key |
| `is_active` | boolean | No | Active status |

**Example Request:**

```json
PUT /api/admin/ai-providers/12

{
  "name": "Test Provider Updated",
  "is_active": false
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "AI provider updated successfully.",
  "data": {
    "id": 12,
    "name": "Test Provider Updated",
    "slug": "test-provider-curl",
    "base_url": "https://api.test-provider.com/v1",
    "is_active": false,
    "created_at": "2026-02-06T21:36:54+00:00",
    "updated_at": "2026-02-06T21:37:10+00:00"
  }
}
```

---

### Delete Provider

#### DELETE /api/admin/ai-providers/{id}

Delete a provider. Cannot delete if it has associated models.

**Response (Success):**

```json
{
  "success": true,
  "message": "AI provider deleted successfully.",
  "data": null
}
```

**Response (422 - Has Models):**

```json
{
  "success": false,
  "message": "Cannot delete provider with existing models. Delete or reassign models first.",
  "errors": null
}
```

---

### Test Provider API Key

#### POST /api/admin/ai-providers/{id}/test

Test a provider's API key by making a request to its `/models` endpoint.

**Response (Success - Connection OK):**

```json
{
  "success": true,
  "message": "Provider API key is valid.",
  "data": {
    "success": true,
    "message": "Connection successful",
    "response_time_ms": 450
  }
}
```

**Response (Connection Failed):**

```json
{
  "success": true,
  "message": "Could not connect to provider.",
  "data": {
    "success": false,
    "message": "Connection failed",
    "error": "cURL error 60: SSL certificate problem: unable to get local issuer certificate"
  }
}
```

**Notes:**
- Makes an HTTP GET request to `{base_url}/models` with the provider's API key as Bearer token
- Timeout: 10 seconds
- Returns response time in milliseconds on success
- Returns the error message on failure (HTTP 200 with `data.success: false`)

---

## AI Models

### List All Models

#### GET /api/admin/ai-models

List all AI models with pagination, filtering, and sorting. Each model includes its provider.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `provider_id` | integer | - | Filter by provider ID |
| `supports_vision` | boolean | - | Filter by vision support |
| `supports_streaming` | boolean | - | Filter by streaming support |
| `sort_by` | string | `name` | Sort field (`name`, `input_price_per_1m`, `output_price_per_1m`, `max_context_tokens`, `created_at`) |
| `sort_order` | string | `asc` | Sort order (`asc`, `desc`) |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Example Request:**

```
GET /api/admin/ai-models?provider_id=1&sort_by=input_price_per_1m&sort_order=desc&per_page=3
```

**Response (Success):**

```json
{
  "success": true,
  "message": "AI models retrieved successfully.",
  "data": [
    {
      "id": 3,
      "provider_id": 1,
      "name": "Claude Sonnet 4.5",
      "model_id": "anthropic/claude-sonnet-4.5",
      "input_price_per_1m": "3.0000",
      "output_price_per_1m": "15.0000",
      "max_context_tokens": 200000,
      "supports_vision": true,
      "supports_streaming": true,
      "provider": {
        "id": 1,
        "name": "OpenRouter",
        "slug": "openrouter",
        "base_url": "https://openrouter.ai/api/v1",
        "is_active": true,
        "created_at": "2026-01-19T04:25:31+00:00",
        "updated_at": "2026-01-20T22:58:46+00:00"
      },
      "created_at": "2026-01-19T04:25:31+00:00",
      "updated_at": "2026-01-19T04:25:31+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 3,
    "total": 7,
    "last_page": 3,
    "from": 1,
    "to": 3
  },
  "links": {
    "first": "http://127.0.0.1:8000/api/admin/ai-models?page=1",
    "last": "http://127.0.0.1:8000/api/admin/ai-models?page=3",
    "prev": null,
    "next": "http://127.0.0.1:8000/api/admin/ai-models?page=2"
  }
}
```

---

### Create Model

#### POST /api/admin/ai-models

Create a new AI model.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider_id` | integer | Yes | Provider ID (must exist) |
| `name` | string | Yes | Model display name (max 255) |
| `model_id` | string | Yes | Provider-specific model identifier (max 255, unique per provider) |
| `input_price_per_1m` | numeric | No | Input cost per 1M tokens (min 0) |
| `output_price_per_1m` | numeric | No | Output cost per 1M tokens (min 0) |
| `max_context_tokens` | integer | No | Maximum context window (min 1000) |
| `supports_vision` | boolean | No | Vision capability flag |
| `supports_streaming` | boolean | No | Streaming capability flag |

**Example Request:**

```json
POST /api/admin/ai-models

{
  "provider_id": 1,
  "name": "Test Model GPT-5",
  "model_id": "test/gpt-5",
  "input_price_per_1m": 5.00,
  "output_price_per_1m": 15.00,
  "max_context_tokens": 128000,
  "supports_vision": true,
  "supports_streaming": true
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "AI model created successfully.",
  "data": {
    "id": 18,
    "provider_id": 1,
    "name": "Test Model GPT-5",
    "model_id": "test/gpt-5",
    "input_price_per_1m": "5.0000",
    "output_price_per_1m": "15.0000",
    "max_context_tokens": 128000,
    "supports_vision": true,
    "supports_streaming": true,
    "provider": {
      "id": 1,
      "name": "OpenRouter",
      "slug": "openrouter",
      "base_url": "https://openrouter.ai/api/v1",
      "is_active": true,
      "created_at": "2026-01-19T04:25:31+00:00",
      "updated_at": "2026-01-20T22:58:46+00:00"
    },
    "created_at": "2026-02-06T21:37:42+00:00",
    "updated_at": "2026-02-06T21:37:42+00:00"
  }
}
```

**Validation Error (Missing Fields):**

```json
{
  "success": false,
  "message": "Provider is required. (and 2 more errors)",
  "errors": {
    "provider_id": ["Provider is required."],
    "name": ["Model name is required."],
    "model_id": ["Model ID is required."]
  }
}
```

**Validation Error (Duplicate model_id per Provider):**

```json
{
  "success": false,
  "message": "This model ID already exists for this provider.",
  "errors": {
    "model_id": ["This model ID already exists for this provider."]
  }
}
```

**Validation Error (Non-existent Provider):**

```json
{
  "success": false,
  "message": "Selected provider does not exist.",
  "errors": {
    "provider_id": ["Selected provider does not exist."]
  }
}
```

---

### View Model

#### GET /api/admin/ai-models/{id}

View a specific model with its provider.

**Response (Success):**

```json
{
  "success": true,
  "message": "AI model retrieved successfully.",
  "data": {
    "id": 1,
    "provider_id": 1,
    "name": "GPT-4o",
    "model_id": "openai/gpt-4o",
    "input_price_per_1m": "2.5000",
    "output_price_per_1m": "10.0000",
    "max_context_tokens": 128000,
    "supports_vision": true,
    "supports_streaming": true,
    "provider": {
      "id": 1,
      "name": "OpenRouter",
      "slug": "openrouter",
      "base_url": "https://openrouter.ai/api/v1",
      "is_active": true,
      "created_at": "2026-01-19T04:25:31+00:00",
      "updated_at": "2026-01-20T22:58:46+00:00"
    },
    "created_at": "2026-01-19T04:25:31+00:00",
    "updated_at": "2026-01-19T04:25:31+00:00"
  }
}
```

---

### Update Model

#### PUT /api/admin/ai-models/{id}

Update a model. All fields are optional (partial update).

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider_id` | integer | No | Provider ID |
| `name` | string | No | Model display name |
| `model_id` | string | No | Provider-specific identifier (unique per provider, excluding current) |
| `input_price_per_1m` | numeric | No | Input cost per 1M tokens |
| `output_price_per_1m` | numeric | No | Output cost per 1M tokens |
| `max_context_tokens` | integer | No | Maximum context window |
| `supports_vision` | boolean | No | Vision capability flag |
| `supports_streaming` | boolean | No | Streaming capability flag |

**Example Request:**

```json
PUT /api/admin/ai-models/18

{
  "name": "Test Model Updated",
  "input_price_per_1m": 4.50
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "AI model updated successfully.",
  "data": {
    "id": 18,
    "provider_id": 1,
    "name": "Test Model Updated",
    "model_id": "test/curl-model",
    "input_price_per_1m": "4.5000",
    "output_price_per_1m": "15.0000",
    "max_context_tokens": 128000,
    "supports_vision": true,
    "supports_streaming": true,
    "provider": {
      "id": 1,
      "name": "OpenRouter",
      "slug": "openrouter",
      "base_url": "https://openrouter.ai/api/v1",
      "is_active": true,
      "created_at": "2026-01-19T04:25:31+00:00",
      "updated_at": "2026-01-20T22:58:46+00:00"
    },
    "created_at": "2026-02-06T21:37:42+00:00",
    "updated_at": "2026-02-06T21:37:51+00:00"
  }
}
```

---

### Delete Model

#### DELETE /api/admin/ai-models/{id}

Delete a model.

**Response (Success):**

```json
{
  "success": true,
  "message": "AI model deleted successfully.",
  "data": null
}
```

---

## AI Agents

### List All Agents

#### GET /api/admin/ai-agents

List all AI agents with pagination, filtering, and sorting. Each agent includes its associated model and conversation count.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `active_only` | boolean | - | Filter active agents only |
| `model_id` | integer | - | Filter by AI model ID |
| `sort_by` | string | `name` | Sort field (`name`, `created_at`, `temperature`) |
| `sort_order` | string | `asc` | Sort order (`asc`, `desc`) |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Example Request:**

```
GET /api/admin/ai-agents?active_only=1&model_id=2&sort_by=temperature&sort_order=desc
```

**Response (Success):**

```json
{
  "success": true,
  "message": "AI agents retrieved successfully.",
  "data": [
    {
      "id": 1,
      "model_id": 2,
      "name": "General Assistant",
      "slug": "general-assistant",
      "description": "A helpful general-purpose AI assistant for everyday tasks.",
      "temperature": "0.70",
      "max_response_tokens": 2048,
      "is_active": true,
      "model": {
        "id": 2,
        "provider_id": 1,
        "name": "GPT-4o Mini",
        "model_id": "openai/gpt-4o-mini",
        "input_price_per_1m": "0.1500",
        "output_price_per_1m": "0.6000",
        "max_context_tokens": 128000,
        "supports_vision": true,
        "supports_streaming": true,
        "created_at": "2026-01-19T04:25:31+00:00",
        "updated_at": "2026-01-19T04:25:31+00:00"
      },
      "conversations_count": 23,
      "created_at": "2026-01-19T15:02:11+00:00",
      "updated_at": "2026-01-19T15:02:11+00:00"
    },
    {
      "id": 2,
      "model_id": 2,
      "name": "Legal Research Assistant",
      "slug": "legal-research",
      "description": "An AI assistant specialized in legal research and case analysis.",
      "temperature": "0.50",
      "max_response_tokens": 4096,
      "is_active": true,
      "model": {
        "id": 2,
        "provider_id": 1,
        "name": "GPT-4o Mini",
        "model_id": "openai/gpt-4o-mini",
        "input_price_per_1m": "0.1500",
        "output_price_per_1m": "0.6000",
        "max_context_tokens": 128000,
        "supports_vision": true,
        "supports_streaming": true,
        "created_at": "2026-01-19T04:25:31+00:00",
        "updated_at": "2026-01-19T04:25:31+00:00"
      },
      "conversations_count": 0,
      "created_at": "2026-01-19T15:02:11+00:00",
      "updated_at": "2026-01-19T15:02:11+00:00"
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
    "first": "http://127.0.0.1:8000/api/admin/ai-agents?page=1",
    "last": "http://127.0.0.1:8000/api/admin/ai-agents?page=1",
    "prev": null,
    "next": null
  }
}
```

**Notes:**
- List endpoint loads the `model` relationship (not `model.provider`)
- `conversations_count` shows how many conversations use this agent
- The `system_prompt` field is NOT included in list or detail responses (only stored, not exposed via API resource)

---

### Create Agent

#### POST /api/admin/ai-agents

Create a new AI agent.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model_id` | integer | Yes | AI Model ID (must exist) |
| `name` | string | Yes | Agent name (max 255) |
| `slug` | string | Yes | URL-friendly identifier (max 100, alpha_dash, unique) |
| `description` | string | No | Agent description |
| `system_prompt` | string | Yes | System prompt for the agent |
| `temperature` | numeric | No | Temperature setting (0-2, default 0.70) |
| `max_response_tokens` | integer | No | Max response tokens (100-32000, default 2048) |
| `is_active` | boolean | No | Active status (default: true) |

**Example Request:**

```json
POST /api/admin/ai-agents

{
  "model_id": 2,
  "name": "Test Agent",
  "slug": "test-agent",
  "description": "A test agent created via API",
  "system_prompt": "You are a helpful test assistant.",
  "temperature": 0.7,
  "max_response_tokens": 2048,
  "is_active": true
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "AI agent created successfully.",
  "data": {
    "id": 10,
    "model_id": 2,
    "name": "Test Agent",
    "slug": "test-agent",
    "description": "A test agent created via API",
    "temperature": "0.70",
    "max_response_tokens": 2048,
    "is_active": true,
    "model": {
      "id": 2,
      "provider_id": 1,
      "name": "GPT-4o Mini",
      "model_id": "openai/gpt-4o-mini",
      "input_price_per_1m": "0.1500",
      "output_price_per_1m": "0.6000",
      "max_context_tokens": 128000,
      "supports_vision": true,
      "supports_streaming": true,
      "created_at": "2026-01-19T04:25:31+00:00",
      "updated_at": "2026-01-19T04:25:31+00:00"
    },
    "created_at": "2026-02-06T21:38:09+00:00",
    "updated_at": "2026-02-06T21:38:09+00:00"
  }
}
```

**Validation Error (Missing Fields):**

```json
{
  "success": false,
  "message": "An AI model must be selected. (and 3 more errors)",
  "errors": {
    "model_id": ["An AI model must be selected."],
    "name": ["Agent name is required."],
    "slug": ["Agent slug is required."],
    "system_prompt": ["System prompt is required."]
  }
}
```

**Validation Error (Temperature Out of Range):**

```json
{
  "success": false,
  "message": "Temperature cannot exceed 2.",
  "errors": {
    "temperature": ["Temperature cannot exceed 2."]
  }
}
```

---

### View Agent

#### GET /api/admin/ai-agents/{id}

View a specific agent with its model (including provider) and conversation count.

**Response (Success):**

```json
{
  "success": true,
  "message": "AI agent retrieved successfully.",
  "data": {
    "id": 3,
    "model_id": 3,
    "name": "Lawexa Orchestrator",
    "slug": "lawexa-orchestrator",
    "description": "The primary AI orchestrator for Lawexa. Coordinates legal research tasks, searches cases and notes, and provides comprehensive legal assistance.",
    "temperature": "0.40",
    "max_response_tokens": 4096,
    "is_active": true,
    "model": {
      "id": 3,
      "provider_id": 1,
      "name": "Claude Sonnet 4.5",
      "model_id": "anthropic/claude-sonnet-4.5",
      "input_price_per_1m": "3.0000",
      "output_price_per_1m": "15.0000",
      "max_context_tokens": 200000,
      "supports_vision": true,
      "supports_streaming": true,
      "provider": {
        "id": 1,
        "name": "OpenRouter",
        "slug": "openrouter",
        "base_url": "https://openrouter.ai/api/v1",
        "is_active": true,
        "created_at": "2026-01-19T04:25:31+00:00",
        "updated_at": "2026-01-20T22:58:46+00:00"
      },
      "created_at": "2026-01-19T04:25:31+00:00",
      "updated_at": "2026-01-19T04:25:31+00:00"
    },
    "conversations_count": 44,
    "created_at": "2026-01-20T09:24:41+00:00",
    "updated_at": "2026-01-20T12:06:49+00:00"
  }
}
```

**Notes:**
- Show endpoint loads `model.provider` (list only loads `model`)
- Includes `conversations_count`

---

### Update Agent

#### PUT /api/admin/ai-agents/{id}

Update an agent. All fields are optional (partial update).

**Response (Success):**

```json
{
  "success": true,
  "message": "AI agent updated successfully.",
  "data": {
    "id": 10,
    "model_id": 2,
    "name": "Test Agent Updated",
    "slug": "test-agent-curl",
    "description": "A test agent created via curl",
    "temperature": "0.50",
    "max_response_tokens": 2048,
    "is_active": true,
    "model": { "..." },
    "created_at": "2026-02-06T21:38:09+00:00",
    "updated_at": "2026-02-06T21:38:18+00:00"
  }
}
```

---

### Delete Agent

#### DELETE /api/admin/ai-agents/{id}

Delete an agent. Cannot delete if it has associated conversations.

**Response (Success):**

```json
{
  "success": true,
  "message": "AI agent deleted successfully.",
  "data": null
}
```

**Response (422 - Has Conversations):**

```json
{
  "success": false,
  "message": "Cannot delete agent with existing conversations. Archive the agent instead.",
  "errors": null
}
```

---

## AI Tools

### List All Tools

#### GET /api/admin/ai-tools

List all AI tools with pagination, filtering, and sorting.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `active_only` | boolean | - | Filter active tools only |
| `category` | string | - | Filter by tool category (e.g., `cases`, `notes`, `lawyers`) |
| `sort_by` | string | `name` | Sort field (`name`, `display_name`, `category`, `created_at`) |
| `sort_order` | string | `asc` | Sort order (`asc`, `desc`) |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Example Request:**

```
GET /api/admin/ai-tools?category=cases&active_only=1
```

**Response (Success):**

```json
{
  "success": true,
  "message": "AI tools retrieved successfully.",
  "data": [
    {
      "id": 1,
      "name": "search_cases",
      "display_name": "Search Cases",
      "description": "Search legal cases by keyword, citation, court, or topic.",
      "category": "cases",
      "endpoint_url": "/api/internal/tools/cases/search",
      "http_method": "GET",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Search keywords or citation to find relevant cases"
          },
          "court_id": {
            "type": "integer",
            "description": "Optional: Filter by court ID"
          },
          "limit": {
            "type": "integer",
            "description": "Maximum number of results (default 10, max 20)",
            "default": 10,
            "maximum": 20
          }
        },
        "required": ["query"]
      },
      "timeout_seconds": 30,
      "retry_count": 1,
      "requires_auth": true,
      "is_active": true,
      "agents_count": 3,
      "created_at": "2026-01-20T09:24:20+00:00",
      "updated_at": "2026-01-21T13:04:14+00:00"
    },
    {
      "id": 2,
      "name": "view_case",
      "display_name": "View Case",
      "description": "Get full details of a legal case.",
      "category": "cases",
      "endpoint_url": "/api/internal/tools/cases/{id}",
      "http_method": "GET",
      "parameters": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "The ID or slug of the case to retrieve"
          }
        },
        "required": ["id"]
      },
      "timeout_seconds": 15,
      "retry_count": 1,
      "requires_auth": true,
      "is_active": true,
      "agents_count": 3,
      "created_at": "2026-01-20T09:24:20+00:00",
      "updated_at": "2026-01-21T23:32:24+00:00"
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
  "links": { "..." }
}
```

---

### Create Tool

#### POST /api/admin/ai-tools

Create a new AI tool.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Tool identifier (max 100, alpha_dash, unique) |
| `display_name` | string | Yes | Human-readable name (max 255) |
| `description` | string | Yes | Tool description (for LLM context) |
| `category` | string | No | Tool category (max 50) |
| `endpoint_url` | string | Yes | API endpoint URL (max 500) |
| `http_method` | string | Yes | HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) |
| `parameters` | object | Yes | JSON Schema object defining tool parameters |
| `parameters.type` | string | Yes | Must be `object` |
| `parameters.properties` | object | No | Parameter definitions |
| `timeout_seconds` | integer | No | Timeout in seconds (5-120, default 30) |
| `retry_count` | integer | No | Retry attempts (0-5, default 0) |
| `requires_auth` | boolean | No | Requires authentication (default true) |
| `is_active` | boolean | No | Active status (default true) |

**Example Request:**

```json
POST /api/admin/ai-tools

{
  "name": "test_tool",
  "display_name": "Test Tool",
  "description": "A test tool for documentation purposes",
  "category": "testing",
  "endpoint_url": "/api/internal/tools/test",
  "http_method": "POST",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The test query"
      }
    },
    "required": ["query"]
  },
  "timeout_seconds": 30,
  "retry_count": 2,
  "requires_auth": true,
  "is_active": true
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "AI tool created successfully.",
  "data": {
    "id": 8,
    "name": "test_tool",
    "display_name": "Test Tool",
    "description": "A test tool for documentation purposes",
    "category": "testing",
    "endpoint_url": "/api/internal/tools/test",
    "http_method": "POST",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "The test query"
        }
      }
    },
    "timeout_seconds": 30,
    "retry_count": 2,
    "requires_auth": true,
    "is_active": true,
    "created_at": "2026-02-06T21:38:46+00:00",
    "updated_at": "2026-02-06T21:38:46+00:00"
  }
}
```

**Validation Error (Missing Fields):**

```json
{
  "success": false,
  "message": "Tool name is required. (and 6 more errors)",
  "errors": {
    "name": ["Tool name is required."],
    "display_name": ["Display name is required."],
    "description": ["Description is required for LLM context."],
    "endpoint_url": ["Endpoint URL is required."],
    "http_method": ["HTTP method is required."],
    "parameters": ["Parameters JSON Schema is required."],
    "parameters.type": ["The parameters.type field is required."]
  }
}
```

**Validation Error (Invalid HTTP Method):**

```json
{
  "success": false,
  "message": "HTTP method must be GET, POST, PUT, PATCH, or DELETE.",
  "errors": {
    "http_method": ["HTTP method must be GET, POST, PUT, PATCH, or DELETE."]
  }
}
```

---

### View Tool

#### GET /api/admin/ai-tools/{id}

View a specific tool with its assigned agents.

**Response (Success):**

```json
{
  "success": true,
  "message": "AI tool retrieved successfully.",
  "data": {
    "id": 1,
    "name": "search_cases",
    "display_name": "Search Cases",
    "description": "Search legal cases by keyword, citation, court, or topic.",
    "category": "cases",
    "endpoint_url": "/api/internal/tools/cases/search",
    "http_method": "GET",
    "parameters": { "..." },
    "timeout_seconds": 30,
    "retry_count": 1,
    "requires_auth": true,
    "is_active": true,
    "agents_count": 3,
    "agents": [
      {
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
      {
        "id": 1,
        "model_id": 2,
        "name": "General Assistant",
        "slug": "general-assistant",
        "description": "A helpful general-purpose AI assistant for everyday tasks.",
        "temperature": "0.70",
        "max_response_tokens": 2048,
        "is_active": true,
        "created_at": "2026-01-19T15:02:11+00:00",
        "updated_at": "2026-01-19T15:02:11+00:00"
      }
    ],
    "created_at": "2026-01-20T09:24:20+00:00",
    "updated_at": "2026-01-21T13:04:14+00:00"
  }
}
```

**Notes:**
- Show loads the `agents` relationship (list does not)
- Both list and show include `agents_count`

---

### Update Tool

#### PUT /api/admin/ai-tools/{id}

Update a tool. All fields are optional (partial update).

**Response (Success):**

```json
{
  "success": true,
  "message": "AI tool updated successfully.",
  "data": {
    "id": 8,
    "name": "test_tool_curl",
    "display_name": "Test Tool Updated",
    "description": "A test tool created via curl for documentation",
    "category": "testing",
    "endpoint_url": "/api/internal/tools/test",
    "http_method": "POST",
    "parameters": { "..." },
    "timeout_seconds": 60,
    "retry_count": 2,
    "requires_auth": true,
    "is_active": true,
    "created_at": "2026-02-06T21:38:46+00:00",
    "updated_at": "2026-02-06T21:38:59+00:00"
  }
}
```

---

### Delete Tool

#### DELETE /api/admin/ai-tools/{id}

Delete a tool. Cannot delete if it is assigned to any agents.

**Response (Success):**

```json
{
  "success": true,
  "message": "AI tool deleted successfully.",
  "data": null
}
```

**Response (422 - Assigned to Agents):**

```json
{
  "success": false,
  "message": "Cannot delete tool assigned to agents. Remove from agents first.",
  "errors": null
}
```

---

### Attach Tool to Agent

#### POST /api/admin/ai-tools/{id}/agents/{agentId}

Attach a tool to an agent.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Tool ID |
| `agentId` | integer | Agent ID |

**Response (Success):**

```json
{
  "success": true,
  "message": "Tool attached to agent successfully.",
  "data": {
    "id": 8,
    "name": "test_tool_curl",
    "display_name": "Test Tool Updated",
    "description": "A test tool created via curl for documentation",
    "category": "testing",
    "endpoint_url": "/api/internal/tools/test",
    "http_method": "POST",
    "parameters": { "..." },
    "timeout_seconds": 60,
    "retry_count": 2,
    "requires_auth": true,
    "is_active": true,
    "agents": [
      {
        "id": 10,
        "model_id": 2,
        "name": "Test Agent Updated",
        "slug": "test-agent-curl",
        "description": "A test agent created via curl",
        "temperature": "0.50",
        "max_response_tokens": 2048,
        "is_active": true,
        "created_at": "2026-02-06T21:38:09+00:00",
        "updated_at": "2026-02-06T21:38:18+00:00"
      }
    ],
    "created_at": "2026-02-06T21:38:46+00:00",
    "updated_at": "2026-02-06T21:38:59+00:00"
  }
}
```

**Response (422 - Already Assigned):**

```json
{
  "success": false,
  "message": "Tool is already assigned to this agent.",
  "errors": null
}
```

---

### Detach Tool from Agent

#### DELETE /api/admin/ai-tools/{id}/agents/{agentId}

Detach a tool from an agent.

**Response (Success):**

```json
{
  "success": true,
  "message": "Tool detached from agent successfully.",
  "data": null
}
```

**Response (422 - Not Assigned):**

```json
{
  "success": false,
  "message": "Tool is not assigned to this agent.",
  "errors": null
}
```

---

## AI Workflows

### List All Workflows

#### GET /api/admin/ai-workflows

List all AI workflows with pagination, filtering, and sorting. Each workflow includes its agents and conversation count.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `active_only` | boolean | - | Filter active workflows only |
| `sort_by` | string | `name` | Sort field (`name`, `created_at`, `is_default`) |
| `sort_order` | string | `asc` | Sort order (`asc`, `desc`) |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Example Request:**

```
GET /api/admin/ai-workflows?active_only=1&sort_by=is_default&sort_order=desc
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Workflows retrieved successfully.",
  "data": [
    {
      "id": 7,
      "name": "New Default Workflow",
      "slug": "new-default-workflow",
      "description": null,
      "execution_mode": "simple",
      "orchestrator_agent_id": 3,
      "is_default": true,
      "is_active": true,
      "agents": [
        {
          "id": 3,
          "name": "Lawexa Orchestrator",
          "slug": "lawexa-orchestrator",
          "description": "The primary AI orchestrator for Lawexa.",
          "is_active": true,
          "role": "primary",
          "order": 0
        }
      ],
      "orchestrator_agent": null,
      "conversations_count": 47,
      "created_at": "2026-01-19T21:35:04+00:00",
      "updated_at": "2026-01-20T12:39:11+00:00"
    },
    {
      "id": 9,
      "name": "Lawexa v1",
      "slug": "lawexa-v1",
      "description": "Primary Lawexa workflow with tool-enabled agent.",
      "execution_mode": "react",
      "orchestrator_agent_id": 3,
      "is_default": false,
      "is_active": true,
      "agents": [
        {
          "id": 3,
          "name": "Lawexa Orchestrator",
          "slug": "lawexa-orchestrator",
          "description": "The primary AI orchestrator for Lawexa.",
          "is_active": true,
          "role": "primary",
          "order": 0
        }
      ],
      "orchestrator_agent": null,
      "conversations_count": 6,
      "created_at": "2026-01-20T09:25:09+00:00",
      "updated_at": "2026-01-20T09:25:09+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 5,
    "last_page": 1,
    "from": 1,
    "to": 5
  },
  "links": { "..." }
}
```

**Notes:**
- List loads `agents` with pivot data (`role`, `order`)
- `orchestrator_agent` is null on list (loaded on show)
- Each agent in the list includes `role` and `order` from the pivot table

---

### Create Workflow

#### POST /api/admin/ai-workflows

Create a new workflow with agent assignments.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Workflow name (max 255) |
| `slug` | string | Yes | URL-friendly identifier (max 100, alpha_dash, unique) |
| `description` | string | No | Workflow description |
| `execution_mode` | string | No | Execution mode (`simple`, `react`) |
| `orchestrator_agent_id` | integer | No | Orchestrator agent ID (must exist in ai_agents) |
| `is_default` | boolean | No | Default workflow flag (if true, unsets other defaults) |
| `is_active` | boolean | No | Active status (default true) |
| `agents` | array | Yes | Agent assignments (min 1) |
| `agents.*.agent_id` | integer | Yes | Agent ID (must exist) |
| `agents.*.role` | string | No | Agent role: `primary`, `specialist`, `fallback` (default `primary`) |
| `agents.*.order` | integer | No | Execution order (min 0) |

**Custom Validation:** Exactly one agent must have the `primary` role.

**Example Request:**

```json
POST /api/admin/ai-workflows

{
  "name": "Test Workflow",
  "slug": "test-workflow",
  "description": "A test workflow",
  "execution_mode": "react",
  "orchestrator_agent_id": 10,
  "is_default": false,
  "is_active": true,
  "agents": [
    { "agent_id": 10, "role": "primary", "order": 0 },
    { "agent_id": 3, "role": "specialist", "order": 1 }
  ]
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Workflow created successfully.",
  "data": {
    "id": 10,
    "name": "Test Workflow",
    "slug": "test-workflow",
    "description": "A test workflow",
    "execution_mode": "react",
    "orchestrator_agent_id": 10,
    "is_default": false,
    "is_active": true,
    "agents": [
      {
        "id": 10,
        "name": "Test Agent Updated",
        "slug": "test-agent-curl",
        "description": "A test agent created via curl",
        "is_active": true,
        "role": "primary",
        "order": 0
      }
    ],
    "orchestrator_agent": null,
    "created_at": "2026-02-06T21:39:29+00:00",
    "updated_at": "2026-02-06T21:39:29+00:00"
  }
}
```

**Validation Error (Missing Fields):**

```json
{
  "success": false,
  "message": "Workflow name is required. (and 3 more errors)",
  "errors": {
    "name": ["Workflow name is required."],
    "slug": ["Workflow slug is required."],
    "agents": [
      "At least one agent must be assigned to the workflow.",
      "Exactly one agent must have the primary role."
    ]
  }
}
```

**Validation Error (No Primary Agent):**

```json
{
  "success": false,
  "message": "Exactly one agent must have the primary role.",
  "errors": {
    "agents": ["Exactly one agent must have the primary role."]
  }
}
```

---

### View Workflow

#### GET /api/admin/ai-workflows/{id}

View a specific workflow with agents (including their models), orchestrator agent, and conversation count.

**Response (Success):**

```json
{
  "success": true,
  "message": "Workflow retrieved successfully.",
  "data": {
    "id": 7,
    "name": "New Default Workflow",
    "slug": "new-default-workflow",
    "description": null,
    "execution_mode": "simple",
    "orchestrator_agent_id": 3,
    "is_default": true,
    "is_active": true,
    "agents": [
      {
        "id": 3,
        "name": "Lawexa Orchestrator",
        "slug": "lawexa-orchestrator",
        "description": "The primary AI orchestrator for Lawexa.",
        "is_active": true,
        "role": "primary",
        "order": 0,
        "model": {
          "id": 3,
          "provider_id": 1,
          "name": "Claude Sonnet 4.5",
          "model_id": "anthropic/claude-sonnet-4.5",
          "input_price_per_1m": "3.0000",
          "output_price_per_1m": "15.0000",
          "max_context_tokens": 200000,
          "supports_vision": true,
          "supports_streaming": true,
          "created_at": "2026-01-19T04:25:31+00:00",
          "updated_at": "2026-01-19T04:25:31+00:00"
        }
      }
    ],
    "orchestrator_agent": {
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
    "conversations_count": 47,
    "created_at": "2026-01-19T21:35:04+00:00",
    "updated_at": "2026-01-20T12:39:11+00:00"
  }
}
```

**Notes:**
- Show loads `agents.model` (list only loads `agents` without model)
- Show loads `orchestratorAgent` as a full agent object
- Agents include pivot data: `role` and `order`

---

### Update Workflow

#### PUT /api/admin/ai-workflows/{id}

Update a workflow. All fields are optional. If `agents` array is provided, it syncs (replaces) all agent assignments.

**Example Request:**

```json
PUT /api/admin/ai-workflows/10

{
  "name": "Test Workflow Updated",
  "execution_mode": "simple"
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Workflow updated successfully.",
  "data": {
    "id": 10,
    "name": "Test Workflow Updated",
    "slug": "test-workflow-curl",
    "description": "A test workflow created via curl",
    "execution_mode": "simple",
    "orchestrator_agent_id": 10,
    "is_default": false,
    "is_active": true,
    "agents": [
      {
        "id": 10,
        "name": "Test Agent Updated",
        "slug": "test-agent-curl",
        "description": "A test agent created via curl",
        "is_active": true,
        "role": "primary",
        "order": 0
      }
    ],
    "orchestrator_agent": null,
    "created_at": "2026-02-06T21:39:29+00:00",
    "updated_at": "2026-02-06T21:39:38+00:00"
  }
}
```

**Notes:**
- If `agents` array is provided, all existing agent assignments are replaced (sync)
- If `agents` is omitted, existing agent assignments are preserved
- If `is_default: true` is set and the workflow isn't already default, all other workflows have `is_default` unset

---

### Delete Workflow

#### DELETE /api/admin/ai-workflows/{id}

Delete a workflow. Cannot delete if it has conversations or is the default workflow.

**Response (Success):**

```json
{
  "success": true,
  "message": "Workflow deleted successfully.",
  "data": null
}
```

**Response (422 - Has Conversations):**

```json
{
  "success": false,
  "message": "Cannot delete workflow with existing conversations. Deactivate it instead.",
  "errors": null
}
```

**Response (422 - Is Default):**

Cannot delete the default workflow. Change the default to another workflow first.

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

Returned when the requested resource does not exist.

```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

### 422 Validation Error

Returned when request data fails validation.

```json
{
  "success": false,
  "message": "First error message. (and N more errors)",
  "errors": {
    "field_name": ["Error message for this field."],
    "other_field": ["Another error message."]
  }
}
```

### 422 Business Logic Error

Returned when an operation violates business rules (e.g., deleting a resource with dependencies).

```json
{
  "success": false,
  "message": "Cannot delete [resource] with existing [dependencies]. [Alternative action].",
  "errors": null
}
```

**Business Logic Guards:**

| Resource | Guard | Message |
|----------|-------|---------|
| Provider | Has models | Cannot delete provider with existing models. Delete or reassign models first. |
| Agent | Has conversations | Cannot delete agent with existing conversations. Archive the agent instead. |
| Tool | Has agents | Cannot delete tool assigned to agents. Remove from agents first. |
| Tool-Agent | Already attached | Tool is already assigned to this agent. |
| Tool-Agent | Not attached | Tool is not assigned to this agent. |
| Workflow | Has conversations | Cannot delete workflow with existing conversations. Deactivate it instead. |
| Workflow | Is default | Cannot delete the default workflow. |

---

## Data Models

### AI Provider Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Provider ID |
| `name` | string | Provider name |
| `slug` | string | URL-friendly identifier |
| `base_url` | string | API base URL |
| `is_active` | boolean | Active status |
| `models_count` | integer | Number of associated models (conditional) |
| `models` | array | Array of AiModelResource (show endpoint only) |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

**Note:** The `api_key` field is never exposed in API responses.

### AI Model Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Model ID |
| `provider_id` | integer | Foreign key to provider |
| `name` | string | Model display name |
| `model_id` | string | Provider-specific model identifier |
| `input_price_per_1m` | string (decimal) | Input cost per 1M tokens |
| `output_price_per_1m` | string (decimal) | Output cost per 1M tokens |
| `max_context_tokens` | integer | Maximum context window |
| `supports_vision` | boolean | Vision capability flag |
| `supports_streaming` | boolean | Streaming capability flag |
| `provider` | object | AiProviderResource (when loaded) |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### AI Agent Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Agent ID |
| `model_id` | integer | Foreign key to AI model |
| `name` | string | Agent name |
| `slug` | string | URL-friendly identifier |
| `description` | string\|null | Agent description |
| `temperature` | string (decimal) | Temperature setting (0-2) |
| `max_response_tokens` | integer | Max response token limit |
| `is_active` | boolean | Active status |
| `model` | object | AiModelResource (when loaded) |
| `conversations_count` | integer | Number of conversations (conditional) |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

**Note:** The `system_prompt` field is not exposed in API responses.

### AI Tool Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Tool ID |
| `name` | string | Tool identifier (snake_case) |
| `display_name` | string | Human-readable name |
| `description` | string | Tool description (for LLM context) |
| `category` | string\|null | Tool category |
| `endpoint_url` | string | API endpoint URL |
| `http_method` | string | HTTP method (GET/POST/PUT/PATCH/DELETE) |
| `parameters` | object | JSON Schema defining tool parameters |
| `timeout_seconds` | integer | Timeout in seconds |
| `retry_count` | integer | Retry attempts |
| `requires_auth` | boolean | Requires authentication |
| `is_active` | boolean | Active status |
| `agents_count` | integer | Number of assigned agents (conditional) |
| `agents` | array | Array of AiAgentResource (show endpoint only) |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### AI Workflow Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Workflow ID |
| `name` | string | Workflow name |
| `slug` | string | URL-friendly identifier |
| `description` | string\|null | Workflow description |
| `execution_mode` | string | `simple` or `react` |
| `orchestrator_agent_id` | integer\|null | Orchestrator agent ID |
| `is_default` | boolean | Default workflow flag |
| `is_active` | boolean | Active status |
| `agents` | array | Array of AiWorkflowAgentResource (when loaded) |
| `orchestrator_agent` | object\|null | AiAgentResource (show endpoint only) |
| `conversations_count` | integer | Number of conversations (conditional) |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### AI Workflow Agent Resource (Pivot)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Agent ID |
| `name` | string | Agent name |
| `slug` | string | URL-friendly identifier |
| `description` | string\|null | Agent description |
| `is_active` | boolean | Active status |
| `role` | string | Agent role in workflow (`primary`, `specialist`, `fallback`) |
| `order` | integer | Execution order |
| `model` | object | AiModelResource (show endpoint only) |

---

## Enums

### ExecutionMode

| Value | Description |
|-------|-------------|
| `simple` | Single LLM call with no iteration |
| `react` | Reasoning + Acting loop with tool calls and iterations |

### AgentRole

| Value | Description |
|-------|-------------|
| `primary` | Primary agent (exactly one per workflow, required) |
| `specialist` | Specialist agent for specific tasks |
| `fallback` | Fallback agent used when primary fails |

---

## Dependency Chain

```
AI Providers
  └── AI Models (provider_id → ai_providers.id)
        └── AI Agents (model_id → ai_models.id)
              ├── AI Tools (many-to-many via ai_agent_tools)
              └── AI Workflows (many-to-many via ai_workflow_agents with role/order)
```

**Cascade Behavior:**
- Deleting a provider cascades to its models
- Deleting a model cascades to its agents
- Deleting an agent cascades pivot entries in `ai_agent_tools` and `ai_workflow_agents`
- Business logic guards prevent deletion when meaningful relationships exist (conversations, models, agents)
