# Conversation Analytics Dashboard - API Documentation

## Overview

This endpoint provides a comprehensive analytics dashboard for conversations, powering stat cards, charts, and tables in the admin panel. All data respects a global period selector, with automatic comparison to the equivalent previous period for change tracking.

**Key Features:**
- 6 stat cards with period-over-period change percentages
- 7 chart datasets (time series, distributions, breakdowns)
- 2 data tables (recent conversations, top users)
- Period filtering: today, last 24 hours, this week, last 7 days, this month, last 30 days, single date, or custom date range
- Automatic granularity: hourly for single-day periods, daily for multi-day periods
- Bot/system users excluded from active user counts

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Conversation Analytics](#conversation-analytics)
3. [Period Filtering](#period-filtering)
4. [Response Structure](#response-structure)
   - [Stat Cards](#stat-cards)
   - [Charts](#charts)
   - [Tables](#tables)
5. [Validation & Error Responses](#validation--error-responses)
6. [Data Models](#data-models)

---

## Authentication & Authorization

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/admin/conversations/analytics` | GET | Yes | Admin |

**Middleware:** `auth:sanctum`, `role:admin`

**Unauthenticated (401):**

```json
{
  "success": false,
  "message": "Unauthenticated.",
  "errors": null
}
```

**Non-Admin User (403):**

```json
{
  "success": false,
  "message": "Insufficient permissions. This action requires at least admin role."
}
```

---

## Conversation Analytics

### GET /api/admin/conversations/analytics

Retrieve aggregated analytics data for the conversation dashboard.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `last_30_days` | Period preset (see [Period Presets](#period-presets) table) |
| `date` | date | - | Required when `period=date`. Format: `Y-m-d` |
| `start_date` | date | - | Required when `period=date_range`. Format: `Y-m-d` |
| `end_date` | date | - | Required when `period=date_range`. Format: `Y-m-d` |

**Example Requests:**

```
GET /api/admin/conversations/analytics
GET /api/admin/conversations/analytics?period=today
GET /api/admin/conversations/analytics?period=last_24_hours
GET /api/admin/conversations/analytics?period=last_7_days
GET /api/admin/conversations/analytics?period=this_week
GET /api/admin/conversations/analytics?period=this_month
GET /api/admin/conversations/analytics?period=last_30_days
GET /api/admin/conversations/analytics?period=date&date=2026-02-23
GET /api/admin/conversations/analytics?period=date_range&start_date=2026-01-01&end_date=2026-02-12
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Conversation analytics retrieved successfully.",
  "data": {
    "period": {
      "start": "2026-01-13T00:00:00+00:00",
      "end": "2026-02-12T03:39:57+00:00",
      "comparison_start": "2025-12-13T20:20:02+00:00",
      "comparison_end": "2026-01-12T23:59:59+00:00"
    },
    "granularity": "day",
    "stat_cards": {
      "total_conversations": { "value": 69, "change_percent": 100 },
      "active_users": { "value": 8, "change_percent": 100 },
      "avg_response_time": { "value": 24.8, "change_percent": 100 },
      "error_rate": { "value": 15.1, "change_percent": 100 },
      "total_cost": { "value": 1.1686, "change_percent": 100 },
      "avg_messages_per_conversation": { "value": 2.3, "change_percent": 100 }
    },
    "charts": {
      "conversations_over_time": [
        { "date": "2026-01-19", "conversations": 6, "unique_users": 1 },
        { "date": "2026-01-20", "conversations": 52, "unique_users": 4 }
      ],
      "cost_and_tokens_trend": [
        {
          "date": "2026-01-19",
          "total_cost": 0.0002094,
          "total_tokens": 1060,
          "prompt_tokens": 948,
          "completion_tokens": 112
        }
      ],
      "latency_distribution": [
        { "bucket": "0-5s", "count": 15 },
        { "bucket": "5-10s", "count": 7 },
        { "bucket": "10-20s", "count": 9 },
        { "bucket": "20-30s", "count": 8 },
        { "bucket": "30-60s", "count": 8 },
        { "bucket": "60s+", "count": 6 }
      ],
      "agent_performance": [
        {
          "agent_id": 3,
          "agent_name": "Lawexa Orchestrator",
          "agent_slug": "lawexa-orchestrator",
          "request_count": 46,
          "avg_latency_ms": 23891,
          "total_cost": 1.168437,
          "avg_tokens": 6544,
          "error_count": 8
        }
      ],
      "model_usage": [
        {
          "model_name": "Claude Sonnet 4.5",
          "model_id": "anthropic/claude-sonnet-4.5",
          "request_count": 46,
          "percentage": 86.8
        },
        {
          "model_name": "GPT-4o Mini",
          "model_id": "openai/gpt-4o-mini",
          "request_count": 7,
          "percentage": 13.2
        }
      ],
      "message_role_distribution": [
        { "date": "2026-01-19", "user_count": 8, "assistant_count": 8, "tool_count": 0 },
        { "date": "2026-01-20", "user_count": 65, "assistant_count": 58, "tool_count": 21 }
      ],
      "error_breakdown": [
        { "category": "Validation Error", "count": 6 },
        { "category": "Data Error", "count": 1 },
        { "category": "Connection Error", "count": 1 }
      ]
    },
    "tables": {
      "recent_conversations": [
        {
          "uuid": "da9fe307-592a-478c-8a70-75eae9b5c688",
          "title": "find me election cases",
          "user_name": "Stay Njokede",
          "user_uuid": "af8085d5-89a9-4e1e-9578-f06c26d37120",
          "agent_name": "Lawexa Orchestrator",
          "messages_count": 14,
          "total_cost": 0.1974,
          "avg_latency_ms": 24133,
          "created_at": "2026-01-20T19:19:21+00:00"
        }
      ],
      "top_users": [
        {
          "uuid": "af8085d5-89a9-4e1e-9578-f06c26d37120",
          "name": "Stay Njokede",
          "role": "user",
          "conversations_count": 15,
          "total_messages": 74,
          "total_cost": 0.5829,
          "last_active": "2026-01-20T19:19:21+00:00"
        }
      ]
    }
  }
}
```

---

## Period Filtering

All dashboard components respect the global period selector. When a period changes, **every** stat card, chart, and table updates to reflect data within that period.

### Period Presets

| Preset | Param Value | Granularity | Current Range | Comparison Range |
|--------|-------------|-------------|--------------|-----------------|
| Today | `today` | Hour | Start of today to now | Same duration yesterday |
| Last 24 Hours | `last_24_hours` | Hour | 24 hours ago to now | 48 hours ago to 24 hours ago |
| Single Day | `date` | Hour | Start of day to end of day | Same duration the day before |
| This Week | `this_week` | Day | Start of week to now | Same duration in previous week |
| Last 7 Days | `last_7_days` | Day | 7 days ago to now | 14 days ago to 7 days ago |
| This Month | `this_month` | Day | Start of month to now | Same duration in previous month |
| Last 30 Days (default) | `last_30_days` | Day | 30 days ago to now | 60 days ago to 30 days ago |
| Date Range | `date_range` | Day | `start_date` to `end_date` | Equivalent duration immediately prior |

### Granularity

The `granularity` field in the response indicates how time-series data is grouped:

- **`hour`** — Single-day periods (`today`, `last_24_hours`, `date`). Time-series charts use `hour` as the key (values: `"00"` to `"23"`).
- **`day`** — Multi-day periods (`this_week`, `last_7_days`, `this_month`, `last_30_days`, `date_range`). Time-series charts use `date` as the key (format: `YYYY-MM-DD`).

### Change Percent Calculation

Each stat card includes a `change_percent` comparing the current period to the previous period:

| Scenario | Result |
|----------|--------|
| Previous = 0, Current > 0 | `100.0` (new activity) |
| Previous = 0, Current = 0 | `null` (no data) |
| Previous > 0, Current > 0 | `((current - previous) / previous) * 100` |

**Empty State (no data in period):**

```json
{
  "success": true,
  "message": "Conversation analytics retrieved successfully.",
  "data": {
    "period": {
      "start": "2026-02-12T00:00:00+00:00",
      "end": "2026-02-12T03:40:07+00:00",
      "comparison_start": "2026-02-11T20:19:52+00:00",
      "comparison_end": "2026-02-11T23:59:59+00:00"
    },
    "granularity": "hour",
    "stat_cards": {
      "total_conversations": { "value": 0, "change_percent": null },
      "active_users": { "value": 0, "change_percent": null },
      "avg_response_time": { "value": 0, "change_percent": null },
      "error_rate": { "value": 0, "change_percent": null },
      "total_cost": { "value": 0, "change_percent": null },
      "avg_messages_per_conversation": { "value": 0, "change_percent": null }
    },
    "charts": {
      "conversations_over_time": [],
      "cost_and_tokens_trend": [],
      "latency_distribution": [
        { "bucket": "0-5s", "count": 0 },
        { "bucket": "5-10s", "count": 0 },
        { "bucket": "10-20s", "count": 0 },
        { "bucket": "20-30s", "count": 0 },
        { "bucket": "30-60s", "count": 0 },
        { "bucket": "60s+", "count": 0 }
      ],
      "agent_performance": [],
      "model_usage": [],
      "message_role_distribution": [],
      "error_breakdown": []
    },
    "tables": {
      "recent_conversations": [],
      "top_users": []
    }
  }
}
```

**Notes:**
- `latency_distribution` always returns all 6 buckets (with `count: 0` when empty) to maintain consistent chart structure
- All other charts return empty arrays when no data exists in the period

---

## Response Structure

### Stat Cards

| Card | Source | Calculation | Unit |
|------|--------|-------------|------|
| `total_conversations` | `conversations` | `COUNT(*)` | integer |
| `active_users` | `conversations` + `users` | `COUNT(DISTINCT user_id)` excluding bot/system | integer |
| `avg_response_time` | `ai_responses` | `AVG(latency_ms) / 1000` | seconds |
| `error_rate` | `ai_responses` | `COUNT(error) / COUNT(*)` | percentage |
| `total_cost` | `ai_responses` | `SUM(estimated_cost)` | USD |
| `avg_messages_per_conversation` | `conversations` + `messages` | `AVG(messages per convo)` | float |

Each card returns:
```json
{
  "value": 24.8,
  "change_percent": 100.0
}
```

### Charts

#### conversations_over_time
Conversation counts with unique user counts. Key changes based on granularity (`date` or `hour`).

```json
[{ "date": "2026-01-20", "conversations": 52, "unique_users": 4 }]
```

#### cost_and_tokens_trend
Cost and token usage breakdown. Key changes based on granularity (`date` or `hour`).

```json
[{
  "date": "2026-01-20",
  "total_cost": 1.168437,
  "total_tokens": 301027,
  "prompt_tokens": 278914,
  "completion_tokens": 22113
}]
```

#### latency_distribution
Response time distribution across 6 fixed buckets.

```json
[
  { "bucket": "0-5s", "count": 15 },
  { "bucket": "5-10s", "count": 7 },
  { "bucket": "10-20s", "count": 9 },
  { "bucket": "20-30s", "count": 8 },
  { "bucket": "30-60s", "count": 8 },
  { "bucket": "60s+", "count": 6 }
]
```

#### agent_performance
Per-agent performance metrics.

```json
[{
  "agent_id": 3,
  "agent_name": "Lawexa Orchestrator",
  "agent_slug": "lawexa-orchestrator",
  "request_count": 46,
  "avg_latency_ms": 23891,
  "total_cost": 1.168437,
  "avg_tokens": 6544,
  "error_count": 8
}]
```

#### model_usage
AI model usage distribution with percentages.

```json
[
  { "model_name": "Claude Sonnet 4.5", "model_id": "anthropic/claude-sonnet-4.5", "request_count": 46, "percentage": 86.8 },
  { "model_name": "GPT-4o Mini", "model_id": "openai/gpt-4o-mini", "request_count": 7, "percentage": 13.2 }
]
```

#### message_role_distribution
Message counts by role (user, assistant, tool). Key changes based on granularity (`date` or `hour`).

```json
[{ "date": "2026-01-20", "user_count": 65, "assistant_count": 58, "tool_count": 21 }]
```

#### error_breakdown
Error counts grouped by category.

```json
[
  { "category": "Validation Error", "count": 6 },
  { "category": "Data Error", "count": 1 },
  { "category": "Connection Error", "count": 1 }
]
```

**Error Categories:**

| Category | Matched Pattern |
|----------|----------------|
| No Credits | "no credits", "No credits" |
| Invalid API Key | "Invalid API key" |
| Max Iterations Reached | "maximum" + "iterations" |
| Connection Error | "peer closed connection", "Connection refused" |
| Server Error | "500", "502", "503", "504", "Server Error" |
| Data Error | "Data too long", "Data truncat" |
| Specialist LLM Error | "Specialist LLM" |
| Validation Error | "validation", "invalid", "required" |
| Other | Everything else |

### Tables

#### recent_conversations (limit: 20)

Most recent conversations in the period, ordered by `created_at DESC`.

```json
{
  "uuid": "da9fe307-592a-478c-8a70-75eae9b5c688",
  "title": "find me election cases",
  "user_name": "Stay Njokede",
  "user_uuid": "af8085d5-89a9-4e1e-9578-f06c26d37120",
  "agent_name": "Lawexa Orchestrator",
  "messages_count": 14,
  "total_cost": 0.1974,
  "avg_latency_ms": 24133,
  "created_at": "2026-01-20T19:19:21+00:00"
}
```

#### top_users (limit: 10)

Most active users by conversation count, excluding bots and system users.

```json
{
  "uuid": "af8085d5-89a9-4e1e-9578-f06c26d37120",
  "name": "Stay Njokede",
  "role": "user",
  "conversations_count": 15,
  "total_messages": 74,
  "total_cost": 0.5829,
  "last_active": "2026-01-20T19:19:21+00:00"
}
```

---

## Validation & Error Responses

### 422 Validation Errors

**Invalid period value:**

```
GET /api/admin/conversations/analytics?period=invalid
```

```json
{
  "success": false,
  "message": "Period must be: today, last_24_hours, date, this_week, last_7_days, this_month, last_30_days, or date_range.",
  "errors": {
    "period": ["Period must be: today, last_24_hours, date, this_week, last_7_days, this_month, last_30_days, or date_range."]
  }
}
```

**Date period without date param:**

```
GET /api/admin/conversations/analytics?period=date
```

```json
{
  "success": false,
  "message": "Date is required when using the date period.",
  "errors": {
    "date": ["Date is required when using the date period."]
  }
}
```

**Date range without dates:**

```
GET /api/admin/conversations/analytics?period=date_range
```

```json
{
  "success": false,
  "message": "Start date is required when using date_range period. (and 1 more error)",
  "errors": {
    "start_date": ["Start date is required when using date_range period."],
    "end_date": ["End date is required when using date_range period."]
  }
}
```

**Start date after end date:**

```
GET /api/admin/conversations/analytics?period=date_range&start_date=2026-02-10&end_date=2026-02-05
```

```json
{
  "success": false,
  "message": "Start date must be before or equal to end date. (and 1 more error)",
  "errors": {
    "start_date": ["Start date must be before or equal to end date."],
    "end_date": ["End date must be after or equal to start date."]
  }
}
```

**Invalid date format:**

```
GET /api/admin/conversations/analytics?period=date_range&start_date=not-a-date&end_date=also-not
```

```json
{
  "success": false,
  "message": "The start date field must be a valid date. (and 1 more error)",
  "errors": {
    "start_date": ["The start date field must be a valid date."],
    "end_date": ["The end date field must be a valid date."]
  }
}
```

---

## Data Models

### Period Object

| Field | Type | Description |
|-------|------|-------------|
| `start` | datetime | Current period start (ISO 8601) |
| `end` | datetime | Current period end (ISO 8601) |
| `comparison_start` | datetime | Previous period start (ISO 8601) |
| `comparison_end` | datetime | Previous period end (ISO 8601) |

### Stat Card Object

| Field | Type | Description |
|-------|------|-------------|
| `value` | number | The metric value for the current period |
| `change_percent` | number\|null | Percentage change from previous period. `null` when no data in either period |

### Conversations Over Time Entry

| Field | Type | Description |
|-------|------|-------------|
| `date` or `hour` | string | Date (YYYY-MM-DD) for daily granularity, or hour (`"00"`-`"23"`) for hourly |
| `conversations` | integer | Number of conversations created |
| `unique_users` | integer | Number of distinct users |

### Cost and Tokens Trend Entry

| Field | Type | Description |
|-------|------|-------------|
| `date` or `hour` | string | Date (YYYY-MM-DD) for daily granularity, or hour (`"00"`-`"23"`) for hourly |
| `total_cost` | float | Total estimated cost in USD |
| `total_tokens` | integer | Total tokens used |
| `prompt_tokens` | integer | Input/prompt tokens |
| `completion_tokens` | integer | Output/completion tokens |

### Latency Distribution Entry

| Field | Type | Description |
|-------|------|-------------|
| `bucket` | string | Time range label (e.g., "0-5s", "60s+") |
| `count` | integer | Number of responses in this range |

### Agent Performance Entry

| Field | Type | Description |
|-------|------|-------------|
| `agent_id` | integer | Agent ID |
| `agent_name` | string | Agent display name |
| `agent_slug` | string | URL-friendly identifier |
| `request_count` | integer | Total AI requests handled |
| `avg_latency_ms` | integer | Average response time in milliseconds |
| `total_cost` | float | Total estimated cost in USD |
| `avg_tokens` | integer | Average tokens per request |
| `error_count` | integer | Number of errored responses |

### Model Usage Entry

| Field | Type | Description |
|-------|------|-------------|
| `model_name` | string | AI model display name |
| `model_id` | string | Model identifier (e.g., "anthropic/claude-sonnet-4.5") |
| `request_count` | integer | Number of requests using this model |
| `percentage` | float | Percentage of total requests |

### Message Role Distribution Entry

| Field | Type | Description |
|-------|------|-------------|
| `date` or `hour` | string | Date (YYYY-MM-DD) for daily granularity, or hour (`"00"`-`"23"`) for hourly |
| `user_count` | integer | User messages sent |
| `assistant_count` | integer | Assistant messages generated |
| `tool_count` | integer | Tool call/result messages |

### Error Breakdown Entry

| Field | Type | Description |
|-------|------|-------------|
| `category` | string | Error category label |
| `count` | integer | Number of errors in this category |

### Recent Conversation Entry

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | string | Conversation UUID |
| `title` | string\|null | Conversation title |
| `user_name` | string | User display name |
| `user_uuid` | string | User UUID |
| `agent_name` | string\|null | AI agent name |
| `messages_count` | integer | Total messages in conversation |
| `total_cost` | float | Total estimated cost in USD |
| `avg_latency_ms` | float | Average response latency in milliseconds |
| `created_at` | datetime | ISO 8601 timestamp |

### Top User Entry

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | string | User UUID |
| `name` | string | User display name |
| `role` | string | User role (e.g., "user", "admin") |
| `conversations_count` | integer | Total conversations in period |
| `total_messages` | integer | Total messages sent in period |
| `total_cost` | float | Total estimated cost in USD |
| `last_active` | datetime | Most recent conversation timestamp (ISO 8601) |

---

## Curl Test Results

All tests performed against local dev server on 2026-02-12.

### Authentication & Authorization

| Test | Status | Response |
|------|--------|----------|
| No auth token | 401 | `Unauthenticated.` |
| Invalid/expired token | 401 | `Unauthenticated.` |
| Regular user (non-admin) | 403 | `Insufficient permissions. This action requires at least admin role.` |
| Admin user | 200 | Success |

### Period Validation

| Test | Status | Response |
|------|--------|----------|
| `?period=invalid` | 422 | `Period must be: today, last_24_hours, date, this_week, last_7_days, this_month, last_30_days, or date_range.` |
| `?period=date` (no date param) | 422 | `Date is required when using the date period.` |
| `?period=date_range` (no dates) | 422 | `Start date is required when using date_range period.` |
| `?period=date_range&start_date=2026-02-10&end_date=2026-02-05` | 422 | `Start date must be before or equal to end date.` |
| `?period=date_range&start_date=not-a-date&end_date=also-not` | 422 | `The start date field must be a valid date.` |

### Happy Path Periods

| Test | Status | Granularity | Notes |
|------|--------|-------------|-------|
| No params (defaults to last_30_days) | 200 | day | Returns full dashboard data |
| `?period=today` | 200 | hour | Hourly breakdown of today's data |
| `?period=last_24_hours` | 200 | hour | Rolling 24-hour window |
| `?period=date&date=2026-02-23` | 200 | hour | Specific day with hourly breakdown |
| `?period=this_week` | 200 | day | Current week data |
| `?period=last_7_days` | 200 | day | Rolling 7-day window |
| `?period=this_month` | 200 | day | Current month data |
| `?period=last_30_days` | 200 | day | Rolling 30-day window |
| `?period=date_range&start_date=2026-01-01&end_date=2026-02-12` | 200 | day | Custom range with comparison period |

---

## Implementation Files

| File | Description |
|------|-------------|
| `app/Http/Controllers/Admin/ConversationController.php` | Controller with `analytics()` method |
| `app/Http/Requests/Admin/ConversationAnalyticsRequest.php` | Form request validation |
| `app/Services/ConversationAnalyticsService.php` | All query and aggregation logic |
| `routes/api.php` | Route registration (before `{uuid}` catch-all) |
| `tests/Feature/Admin/ConversationAnalyticsTest.php` | 36 Pest feature tests |
