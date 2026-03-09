# Admin Message Packs (PAYG) - API Documentation

## Overview

These endpoints provide administrative management and analytics for the Pay-As-You-Go (PAYG) message pack system. Admins can list all purchases, view individual pack details, and access a full analytics dashboard with stat cards, charts, and tables.

**Key Features:**
- List all message packs with filtering, sorting, and pagination
- View individual pack details including transaction metadata
- Analytics dashboard with 6 stat cards, 3 charts, and 2 tables
- Period filtering with automatic hourly/daily granularity
- Soft-deleted users are included with real names and `is_deleted` flags
- Bot/system users excluded from analytics

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [List Message Packs](#list-message-packs)
3. [Show Message Pack](#show-message-pack)
4. [Message Pack Analytics](#message-pack-analytics)
   - [Period Filtering](#period-filtering)
   - [Stat Cards](#stat-cards)
   - [Charts](#charts)
   - [Tables](#tables)
5. [Validation & Error Responses](#validation--error-responses)
6. [Data Models](#data-models)

---

## Authentication & Authorization

All endpoints require authentication via Sanctum and admin role.

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/admin/message-packs` | GET | Yes | Admin |
| `/api/admin/message-packs/{id}` | GET | Yes | Admin |
| `/api/admin/message-packs/analytics` | GET | Yes | Admin |

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

## List Message Packs

### GET /api/admin/message-packs

List all message packs with filtering, sorting, and pagination. Includes user info for each pack (including soft-deleted users).

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status: `pending`, `completed`, `failed`, `refunded` |
| `search` | string | - | Search by user name or email (max 100 chars) |
| `start_date` | date | - | Filter packs created on or after this date |
| `end_date` | date | - | Filter packs created on or before this date |
| `min_amount` | numeric | - | Minimum amount filter |
| `max_amount` | numeric | - | Maximum amount filter (must be >= min_amount) |
| `sort_by` | string | `created_at` | Sort field: `created_at`, `amount`, `paid_at`, `messages_total` |
| `sort_order` | string | `desc` | Sort direction: `asc`, `desc` |
| `per_page` | integer | `15` | Items per page (1-100) |

**Example Requests:**

```
GET /api/admin/message-packs
GET /api/admin/message-packs?status=completed&sort_by=amount&sort_order=desc&per_page=3
GET /api/admin/message-packs?search=Ernesto
GET /api/admin/message-packs?start_date=2026-03-01&end_date=2026-03-09
GET /api/admin/message-packs?min_amount=5000&max_amount=20000
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Message packs retrieved successfully.",
  "data": [
    {
      "id": 55,
      "user": {
        "uuid": "1323c57d-a642-45ba-ba22-58ca8d79e00a",
        "name": "System Bot",
        "email": "bot@system.lawexa.local"
      },
      "quantity": 2,
      "messages_total": 40,
      "messages_remaining": 10,
      "messages_consumed": 30,
      "amount": 8000,
      "formatted_amount": "\u20a68,000.00",
      "currency": "NGN",
      "status": "completed",
      "status_label": "Completed",
      "paid_at": "2026-03-09T12:16:36+00:00",
      "created_at": "2026-03-09T12:16:36+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 13,
    "last_page": 1,
    "from": 1,
    "to": 13
  },
  "links": {
    "first": "http://localhost:8000/api/admin/message-packs?page=1",
    "last": "http://localhost:8000/api/admin/message-packs?page=1",
    "prev": null,
    "next": null
  }
}
```

**Notes:**
- `messages_consumed` is a computed field: `messages_total - messages_remaining`
- `formatted_amount` includes the currency symbol and formatting
- Soft-deleted users are included — their name and email are shown normally
- Results include packs of all statuses unless filtered

---

## Show Message Pack

### GET /api/admin/message-packs/{id}

View a single message pack with full details including transaction reference and metadata.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | The message pack ID |

**Example Request:**

```
GET /api/admin/message-packs/44
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Message pack retrieved successfully.",
  "data": {
    "id": 44,
    "user": {
      "uuid": "4b2024ac-7662-4c92-adba-ba47321b418c",
      "name": "Ernesto Okuneva Sr.",
      "email": "payg-test@example.com",
      "role": "user",
      "avatar_url": null
    },
    "quantity": 3,
    "messages_total": 30,
    "messages_remaining": 0,
    "messages_consumed": 30,
    "amount": 6000,
    "formatted_amount": "\u20a66,000.00",
    "currency": "NGN",
    "status": "completed",
    "status_label": "Completed",
    "transaction_reference": "msgpack_test_001_1773056920",
    "metadata": {
      "gateway_response": "Successful",
      "channel": "card"
    },
    "paid_at": "2026-02-27T11:48:40+00:00",
    "created_at": "2026-03-09T11:48:40+00:00",
    "updated_at": "2026-03-09T11:48:40+00:00"
  }
}
```

**Response (Not Found - 404):**

```json
{
  "success": false,
  "message": "Message pack not found.",
  "errors": null
}
```

**Notes:**
- The detail view includes additional fields not in the list: `transaction_reference`, `metadata`, `updated_at`
- User object in the detail view includes `role` and `avatar_url`
- Soft-deleted users are shown with their real information

---

## Message Pack Analytics

### GET /api/admin/message-packs/analytics

Comprehensive analytics dashboard for message pack purchases. Returns stat cards with period-over-period comparisons, time-series charts, and data tables.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `last_30_days` | Period preset (see [Period Presets](#period-presets)) |
| `date` | date | - | Required when `period=date`. Format: `Y-m-d` |
| `start_date` | date | - | Required when `period=date_range`. Format: `Y-m-d` |
| `end_date` | date | - | Required when `period=date_range`. Format: `Y-m-d` |

**Example Requests:**

```
GET /api/admin/message-packs/analytics
GET /api/admin/message-packs/analytics?period=today
GET /api/admin/message-packs/analytics?period=last_7_days
GET /api/admin/message-packs/analytics?period=date&date=2026-03-08
GET /api/admin/message-packs/analytics?period=date_range&start_date=2026-02-01&end_date=2026-03-09
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Message pack analytics retrieved successfully.",
  "data": {
    "period": {
      "start": "2026-02-07T00:00:00+00:00",
      "end": "2026-03-09T14:18:23+00:00",
      "comparison_start": "2026-01-07T09:41:36+00:00",
      "comparison_end": "2026-02-06T23:59:59+00:00"
    },
    "granularity": "day",
    "stat_cards": {
      "total_revenue": { "value": 76000, "change_percent": 100 },
      "total_packs_sold": { "value": 8, "change_percent": 100 },
      "total_messages_purchased": { "value": 380, "change_percent": 100 },
      "total_messages_consumed": { "value": 256, "change_percent": 100 },
      "consumption_rate": { "value": 67.4, "change_percent": null },
      "avg_pack_size": { "value": 4.1, "change_percent": null }
    },
    "charts": {
      "revenue_over_time": [
        { "date": "2026-02-27", "revenue": 12000 },
        { "date": "2026-03-08", "revenue": 52000 }
      ],
      "purchases_over_time": [
        { "date": "2026-02-27", "count": 2 },
        { "date": "2026-03-08", "count": 3 }
      ],
      "status_distribution": [
        { "status": "completed", "label": "Completed", "count": 8, "percentage": 61.5 },
        { "status": "failed", "label": "Failed", "count": 2, "percentage": 15.4 },
        { "status": "pending", "label": "Pending", "count": 2, "percentage": 15.4 },
        { "status": "refunded", "label": "Refunded", "count": 1, "percentage": 7.7 }
      ]
    },
    "tables": {
      "top_buyers": [
        {
          "user_uuid": "1323c57d-a642-45ba-ba22-58ca8d79e00a",
          "user_name": "System Bot",
          "user_email": "bot@system.lawexa.local",
          "is_deleted": false,
          "total_spent": 20000,
          "total_messages": 100,
          "pack_count": 2
        }
      ],
      "recent_purchases": [
        {
          "id": 55,
          "user_name": "System Bot",
          "user_email": "bot@system.lawexa.local",
          "user_uuid": "1323c57d-a642-45ba-ba22-58ca8d79e00a",
          "is_deleted": false,
          "quantity": 2,
          "messages_total": 40,
          "amount": 8000,
          "currency": "NGN",
          "paid_at": "2026-03-09T12:16:36+00:00"
        }
      ]
    }
  }
}
```

---

## Period Filtering

All analytics components respect the global period selector. When a period changes, every stat card, chart, and table updates to reflect data within that period.

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

**Hourly granularity example (`period=today`):**

```json
{
  "granularity": "hour",
  "charts": {
    "revenue_over_time": [
      { "hour": "12", "revenue": 8000 }
    ],
    "purchases_over_time": [
      { "hour": "12", "count": 1 }
    ]
  }
}
```

### Change Percent Calculation

Each stat card includes a `change_percent` comparing the current period to the previous period:

| Scenario | Result |
|----------|--------|
| Previous = 0, Current > 0 | `100.0` (new activity) |
| Previous = 0, Current = 0 | `null` (no data) |
| Previous > 0, Current > 0 | `((current - previous) / previous) * 100` |

---

## Stat Cards

| Card | Description | Unit |
|------|-------------|------|
| `total_revenue` | Sum of completed pack amounts | currency (minor units) |
| `total_packs_sold` | Count of completed packs | integer |
| `total_messages_purchased` | Sum of `messages_total` from completed packs | integer |
| `total_messages_consumed` | Sum of consumed messages from completed packs | integer |
| `consumption_rate` | `(consumed / purchased) * 100` | percentage |
| `avg_pack_size` | Average pack quantity (completed packs) | float |

Each card returns:
```json
{
  "value": 76000,
  "change_percent": 100.0
}
```

**Notes:**
- `consumption_rate` and `avg_pack_size` have `change_percent: null` when comparison is not meaningful
- Revenue values are in minor currency units (e.g., kobo for NGN)

---

## Charts

### revenue_over_time
Revenue from completed packs over time (line/bar chart). Key is `date` or `hour` based on granularity.

```json
[
  { "date": "2026-02-27", "revenue": 12000 },
  { "date": "2026-03-08", "revenue": 52000 }
]
```

### purchases_over_time
Count of completed purchases over time (bar chart). Key is `date` or `hour` based on granularity.

```json
[
  { "date": "2026-02-27", "count": 2 },
  { "date": "2026-03-08", "count": 3 }
]
```

### status_distribution
Breakdown of all packs by status (donut/pie chart). Not period-dependent — shows all-time distribution.

```json
[
  { "status": "completed", "label": "Completed", "count": 8, "percentage": 61.5 },
  { "status": "failed", "label": "Failed", "count": 2, "percentage": 15.4 },
  { "status": "pending", "label": "Pending", "count": 2, "percentage": 15.4 },
  { "status": "refunded", "label": "Refunded", "count": 1, "percentage": 7.7 }
]
```

---

## Tables

### top_buyers (limit: 10)

Top users by total spending on completed packs within the period. Includes soft-deleted users with `is_deleted` flag.

```json
{
  "user_uuid": "4b2024ac-7662-4c92-adba-ba47321b418c",
  "user_name": "Ernesto Okuneva Sr.",
  "user_email": "payg-test@example.com",
  "is_deleted": true,
  "total_spent": 8000,
  "total_messages": 40,
  "pack_count": 2
}
```

| Field | Type | Description |
|-------|------|-------------|
| `user_uuid` | string | User UUID |
| `user_name` | string\|null | User name (real name even if deleted) |
| `user_email` | string\|null | User email (real email even if deleted) |
| `is_deleted` | boolean | Whether the user account has been soft-deleted |
| `total_spent` | float | Total amount spent in the period |
| `total_messages` | integer | Total messages purchased in the period |
| `pack_count` | integer | Number of packs bought in the period |

### recent_purchases (limit: 15)

Latest completed purchases within the period, ordered by `paid_at` descending. Includes soft-deleted users with `is_deleted` flag.

```json
{
  "id": 55,
  "user_name": "System Bot",
  "user_email": "bot@system.lawexa.local",
  "user_uuid": "1323c57d-a642-45ba-ba22-58ca8d79e00a",
  "is_deleted": false,
  "quantity": 2,
  "messages_total": 40,
  "amount": 8000,
  "currency": "NGN",
  "paid_at": "2026-03-09T12:16:36+00:00"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Message pack ID |
| `user_name` | string\|null | User name |
| `user_email` | string\|null | User email |
| `user_uuid` | string\|null | User UUID |
| `is_deleted` | boolean | Whether the user account has been soft-deleted |
| `quantity` | integer | Number of pack units purchased |
| `messages_total` | integer | Total messages in the pack |
| `amount` | float | Amount paid (minor currency units) |
| `currency` | string | Currency code (e.g., `NGN`) |
| `paid_at` | string | Payment timestamp (ISO 8601) |

---

## Validation & Error Responses

### List Endpoint Validation (422)

**Invalid status:**
```
GET /api/admin/message-packs?status=invalid
```
```json
{
  "success": false,
  "message": "Status must be one of: pending, completed, failed, refunded.",
  "errors": {
    "status": ["Status must be one of: pending, completed, failed, refunded."]
  }
}
```

**Invalid sort_by:**
```
GET /api/admin/message-packs?sort_by=invalid
```
```json
{
  "success": false,
  "message": "Sort by must be one of: created_at, amount, paid_at, messages_total.",
  "errors": {
    "sort_by": ["Sort by must be one of: created_at, amount, paid_at, messages_total."]
  }
}
```

**Search too long:**
```
GET /api/admin/message-packs?search=<101+ chars>
```
```json
{
  "success": false,
  "message": "Search query must not exceed 100 characters.",
  "errors": {
    "search": ["Search query must not exceed 100 characters."]
  }
}
```

### Analytics Endpoint Validation (422)

**Invalid period:**
```
GET /api/admin/message-packs/analytics?period=invalid
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
GET /api/admin/message-packs/analytics?period=date
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
GET /api/admin/message-packs/analytics?period=date_range
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

**Date range exceeds 366 days:**
```json
{
  "success": false,
  "message": "The date range must not exceed 366 days.",
  "errors": {
    "end_date": ["The date range must not exceed 366 days."]
  }
}
```

---

## Data Models

### Message Pack List Item

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Pack ID |
| `user` | object | `{ uuid, name, email }` |
| `quantity` | integer | Number of pack units |
| `messages_total` | integer | Total messages in the pack |
| `messages_remaining` | integer | Unused messages |
| `messages_consumed` | integer | Used messages (computed: total - remaining) |
| `amount` | integer | Amount in minor currency units |
| `formatted_amount` | string | Formatted amount with currency symbol |
| `currency` | string | Currency code |
| `status` | string | `pending`, `completed`, `failed`, `refunded` |
| `status_label` | string | Human-readable status |
| `paid_at` | string\|null | Payment timestamp (ISO 8601), null if unpaid |
| `created_at` | string | Creation timestamp (ISO 8601) |

### Message Pack Detail Item

Extends list item with:

| Field | Type | Description |
|-------|------|-------------|
| `user.role` | string | User role |
| `user.avatar_url` | string\|null | User avatar URL |
| `transaction_reference` | string\|null | Payment gateway reference |
| `metadata` | object\|null | Payment gateway metadata (gateway_response, channel, etc.) |
| `updated_at` | string | Last update timestamp (ISO 8601) |

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
| `change_percent` | number\|null | Percentage change from previous period |

---

## Implementation Files

| File | Description |
|------|-------------|
| `app/Http/Controllers/Admin/MessagePackController.php` | Controller with `index()`, `show()`, `analytics()` methods |
| `app/Http/Requests/Admin/ListMessagePacksRequest.php` | List endpoint validation |
| `app/Http/Requests/Admin/MessagePackAnalyticsRequest.php` | Analytics endpoint validation |
| `app/Http/Resources/Admin/MessagePackResource.php` | List item API resource |
| `app/Http/Resources/Admin/MessagePackDetailResource.php` | Detail item API resource |
| `app/Services/MessagePackAnalyticsService.php` | Analytics query and aggregation logic |
| `routes/api.php` | Route registration |
| `tests/Feature/Admin/MessagePackControllerTest.php` | Pest feature tests |
