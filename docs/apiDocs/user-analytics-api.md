# User Analytics Dashboard - API Documentation

## Overview

This endpoint provides a comprehensive user demographics, growth, and engagement analytics dashboard for the admin panel. All data respects a global period selector, with automatic comparison to the equivalent previous period for change tracking.

**Key Features:**
- 9 stat cards with period-over-period change percentages and registered/guest breakdowns
- 11 chart datasets (growth trends, engagement metrics, demographic distributions)
- 3 data tables (daily breakdown, top universities, international universities)
- Period filtering: today, last 24 hours, this week, last 7 days, this month, last 30 days, single date, or custom date range
- Automatic granularity: hourly for single-day periods, daily for multi-day periods
- Guest vs registered user tracking across all metrics
- Bot/system users excluded from all counts and distributions

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [User Analytics](#user-analytics)
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
| `/api/admin/users/analytics` | GET | Yes | Admin |

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

## User Analytics

### GET /api/admin/users/analytics

Retrieve aggregated user demographics, growth, and engagement analytics for the admin dashboard.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `last_30_days` | Period preset (see [Period Presets](#period-presets) table) |
| `date` | date | - | Required when `period=date`. Format: `Y-m-d` |
| `start_date` | date | - | Required when `period=date_range`. Format: `Y-m-d` |
| `end_date` | date | - | Required when `period=date_range`. Format: `Y-m-d` |

**Example Requests:**

```
GET /api/admin/users/analytics
GET /api/admin/users/analytics?period=today
GET /api/admin/users/analytics?period=last_24_hours
GET /api/admin/users/analytics?period=last_7_days
GET /api/admin/users/analytics?period=this_week
GET /api/admin/users/analytics?period=this_month
GET /api/admin/users/analytics?period=last_30_days
GET /api/admin/users/analytics?period=date&date=2026-02-23
GET /api/admin/users/analytics?period=date_range&start_date=2026-01-01&end_date=2026-03-09
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "User analytics retrieved successfully.",
  "data": {
    "period": {
      "start": "2026-02-07T00:00:00+00:00",
      "end": "2026-03-09T14:18:53+00:00",
      "comparison_start": "2026-01-07T09:41:06+00:00",
      "comparison_end": "2026-02-06T23:59:59+00:00"
    },
    "granularity": "day",
    "stat_cards": {
      "currently_online": {
        "value": 1,
        "registered": 1,
        "guest": 0
      },
      "new_users": {
        "value": 39,
        "registered": 37,
        "guest": 2,
        "change_percent": -44.3
      },
      "total_users": {
        "value": 117,
        "registered": 115,
        "guest": 2,
        "change_percent": 50
      },
      "activation_rate": {
        "ai_activation": {
          "value": 0,
          "activated_count": 0,
          "total_signups": 37,
          "change_percent": -100
        },
        "content_activation": {
          "value": 5.4,
          "activated_count": 2,
          "total_signups": 37,
          "change_percent": 25.6
        }
      },
      "returning_users": {
        "value": 0,
        "registered": 0,
        "guest": 0,
        "returning_rate": 0,
        "change_percent": null
      },
      "total_conversations": {
        "value": 10,
        "change_percent": -85.5
      },
      "total_ai_responses": {
        "value": 0,
        "change_percent": -100
      },
      "total_tokens": {
        "value": 0,
        "change_percent": -100
      },
      "total_cost": {
        "value": 0,
        "change_percent": -100
      }
    },
    "charts": {
      "user_growth": [
        { "date": "2026-02-09", "total": 4, "registered": 3, "guest": 1 },
        { "date": "2026-02-23", "total": 7, "registered": 7, "guest": 0 }
      ],
      "user_type_distribution": [
        { "type": "Registered", "count": 37, "percentage": 94.9 },
        { "type": "Guest", "count": 2, "percentage": 5.1 }
      ],
      "active_users_over_time": [
        { "date": "2026-03-08", "total": 1, "registered": 1, "guest": 0 },
        { "date": "2026-03-09", "total": 2, "registered": 2, "guest": 0 }
      ],
      "auth_provider_distribution": [
        { "provider": "Email", "count": 37, "percentage": 94.9 },
        { "provider": "Guest", "count": 2, "percentage": 5.1 }
      ],
      "conversations_and_messages": [
        { "date": "2026-02-16", "conversations": 10, "messages": 9 }
      ],
      "token_usage": [],
      "daily_cost": [],
      "profession_distribution": [
        { "profession": "student", "count": 1, "percentage": 33.3 },
        { "profession": "lawyer", "count": 1, "percentage": 33.3 }
      ],
      "area_of_study_distribution": [
        { "area_of_study": "Law", "count": 1, "percentage": 100 }
      ],
      "country_distribution": [
        { "country": "Nigeria", "count": 2, "percentage": 66.7 },
        { "country": "Ghana", "count": 1, "percentage": 33.3 }
      ],
      "law_school_distribution": []
    },
    "tables": {
      "daily_breakdown": [
        {
          "date": "2026-02-16",
          "new_users": 0,
          "new_guests": 0,
          "conversations": 10,
          "messages": 10,
          "ai_responses": 0,
          "total_tokens": 0,
          "cost": 0
        }
      ],
      "top_universities": [],
      "international_universities": []
    }
  }
}
```

**Hourly Response Example (`period=today`):**

```json
{
  "success": true,
  "message": "User analytics retrieved successfully.",
  "data": {
    "period": {
      "start": "2026-03-09T00:00:00+00:00",
      "end": "2026-03-09T14:18:54+00:00",
      "comparison_start": "2026-03-08T09:41:05+00:00",
      "comparison_end": "2026-03-08T23:59:59+00:00"
    },
    "granularity": "hour",
    "stat_cards": { "..." : "..." },
    "charts": {
      "user_growth": [],
      "active_users_over_time": [
        { "hour": "11", "total": 1, "registered": 1, "guest": 0 },
        { "hour": "12", "total": 1, "registered": 1, "guest": 0 },
        { "hour": "14", "total": 1, "registered": 1, "guest": 0 }
      ],
      "..." : "..."
    },
    "tables": {
      "daily_breakdown": [],
      "top_universities": [],
      "international_universities": []
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

- **`hour`** — Single-day periods (`today`, `last_24_hours`, `date`). Time-series charts and tables use `hour` as the key (values: `"00"` to `"23"`).
- **`day`** — Multi-day periods (`this_week`, `last_7_days`, `this_month`, `last_30_days`, `date_range`). Time-series charts and tables use `date` as the key (format: `YYYY-MM-DD`).

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
  "message": "User analytics retrieved successfully.",
  "data": {
    "period": { "..." : "..." },
    "granularity": "hour",
    "stat_cards": {
      "currently_online": { "value": 0, "registered": 0, "guest": 0 },
      "new_users": { "value": 0, "registered": 0, "guest": 0, "change_percent": null },
      "total_users": { "value": 117, "registered": 115, "guest": 2, "change_percent": 0 },
      "activation_rate": {
        "ai_activation": { "value": 0, "activated_count": 0, "total_signups": 0, "change_percent": null },
        "content_activation": { "value": 0, "activated_count": 0, "total_signups": 0, "change_percent": null }
      },
      "returning_users": { "value": 0, "registered": 0, "guest": 0, "returning_rate": 0, "change_percent": null },
      "total_conversations": { "value": 0, "change_percent": null },
      "total_ai_responses": { "value": 0, "change_percent": null },
      "total_tokens": { "value": 0, "change_percent": null },
      "total_cost": { "value": 0, "change_percent": null }
    },
    "charts": {
      "user_growth": [],
      "user_type_distribution": [
        { "type": "Registered", "count": 0, "percentage": 0 },
        { "type": "Guest", "count": 0, "percentage": 0 }
      ],
      "active_users_over_time": [],
      "auth_provider_distribution": [],
      "conversations_and_messages": [],
      "token_usage": [],
      "daily_cost": [],
      "profession_distribution": [],
      "area_of_study_distribution": [],
      "country_distribution": [],
      "law_school_distribution": []
    },
    "tables": {
      "daily_breakdown": [],
      "top_universities": [],
      "international_universities": []
    }
  }
}
```

**Notes:**
- All charts and tables return empty arrays when no data exists in the period
- `user_type_distribution` always returns both entries (even with zero counts)
- `total_users` reflects all-time count, not period-specific — so it's always populated
- `currently_online` is real-time (not period-dependent) and has no `change_percent`
- Demographic distributions only include non-null, non-empty values

---

## Response Structure

### Stat Cards

#### currently_online (real-time)
Users with token activity in the last 5 minutes. Not period-dependent.

```json
{
  "value": 1,
  "registered": 1,
  "guest": 0
}
```

#### new_users
New user registrations in the current period, split by registered vs guest.

```json
{
  "value": 39,
  "registered": 37,
  "guest": 2,
  "change_percent": -44.3
}
```

#### total_users
Cumulative user count (all time). Split by registered vs guest.

```json
{
  "value": 117,
  "registered": 115,
  "guest": 2,
  "change_percent": 50
}
```

#### activation_rate
Two sub-metrics tracking how many new registered signups in the period became active:

- **ai_activation**: Users who triggered at least one AI response
- **content_activation**: Users who created at least one conversation

```json
{
  "ai_activation": {
    "value": 0,
    "activated_count": 0,
    "total_signups": 37,
    "change_percent": -100
  },
  "content_activation": {
    "value": 5.4,
    "activated_count": 2,
    "total_signups": 37,
    "change_percent": 25.6
  }
}
```

| Field | Description |
|-------|-------------|
| `value` | Activation rate as percentage |
| `activated_count` | Number of users who activated |
| `total_signups` | Total registered signups in period |
| `change_percent` | Rate change vs previous period |

#### returning_users
Users active in both the current and previous period.

```json
{
  "value": 0,
  "registered": 0,
  "guest": 0,
  "returning_rate": 0,
  "change_percent": null
}
```

| Field | Description |
|-------|-------------|
| `value` | Total returning users |
| `registered` | Returning registered users |
| `guest` | Returning guest users |
| `returning_rate` | Percentage of current active users who are returning |

#### total_conversations, total_ai_responses, total_tokens, total_cost
Simple stat cards with value and change_percent:

```json
{ "value": 10, "change_percent": -85.5 }
```

| Card | Source | Calculation | Unit |
|------|--------|-------------|------|
| `total_conversations` | `conversations` | `COUNT(*)` | integer |
| `total_ai_responses` | `ai_responses` | `COUNT(*)` | integer |
| `total_tokens` | `ai_responses` | `SUM(total_tokens)` | integer |
| `total_cost` | `ai_responses` | `SUM(estimated_cost)` | USD |

---

### Charts

#### user_growth
New user registration counts with registered/guest breakdown (stacked bar chart). Key changes based on granularity.

**Daily granularity (multi-day periods):**
```json
[
  { "date": "2026-02-09", "total": 4, "registered": 3, "guest": 1 },
  { "date": "2026-02-23", "total": 7, "registered": 7, "guest": 0 }
]
```

**Hourly granularity (single-day periods):**
```json
[
  { "hour": "09", "total": 3, "registered": 2, "guest": 1 },
  { "hour": "14", "total": 1, "registered": 1, "guest": 0 }
]
```

#### user_type_distribution
Breakdown of new users by type in the period (donut chart). Always returns both entries.

```json
[
  { "type": "Registered", "count": 37, "percentage": 94.9 },
  { "type": "Guest", "count": 2, "percentage": 5.1 }
]
```

#### active_users_over_time (DAU)
Daily/hourly active user counts based on token activity. Split by registered/guest.

**Daily granularity:**
```json
[
  { "date": "2026-03-08", "total": 1, "registered": 1, "guest": 0 },
  { "date": "2026-03-09", "total": 2, "registered": 2, "guest": 0 }
]
```

**Hourly granularity:**
```json
[
  { "hour": "11", "total": 1, "registered": 1, "guest": 0 },
  { "hour": "14", "total": 1, "registered": 1, "guest": 0 }
]
```

#### auth_provider_distribution
Breakdown of how users signed up (donut chart). Only includes providers with non-zero counts.

```json
[
  { "provider": "Email", "count": 37, "percentage": 94.9 },
  { "provider": "Guest", "count": 2, "percentage": 5.1 }
]
```

Possible providers: `Email`, `Google`, `Guest`

#### conversations_and_messages
New conversations overlaid with user message counts (dual-line chart). Key changes based on granularity.

**Daily granularity:**
```json
[{ "date": "2026-02-16", "conversations": 10, "messages": 9 }]
```

**Hourly granularity:**
```json
[{ "hour": "14", "conversations": 5, "messages": 8 }]
```

**Note:** `messages` only counts messages with `role=user` (excludes assistant and tool messages).

#### token_usage
Total token consumption (bar chart). Key changes based on granularity (`date` or `hour`).

```json
[{ "date": "2026-01-20", "total_tokens": 301027 }]
```

#### daily_cost
Estimated API cost in USD (line chart). Key changes based on granularity (`date` or `hour`).

```json
[{ "date": "2026-01-20", "cost": 1.168437 }]
```

#### profession_distribution
User breakdown by profession with percentages (donut chart).

```json
[
  { "profession": "student", "count": 1, "percentage": 33.3 },
  { "profession": "lawyer", "count": 1, "percentage": 33.3 }
]
```

#### area_of_study_distribution
User breakdown by area of study with percentages (donut chart).

```json
[
  { "area_of_study": "Law", "count": 1, "percentage": 100 }
]
```

#### country_distribution
Geographic distribution of users with percentages (horizontal bar chart).

```json
[
  { "country": "Nigeria", "count": 2, "percentage": 66.7 },
  { "country": "Ghana", "count": 1, "percentage": 33.3 }
]
```

#### law_school_distribution
Nigerian Law School campus breakdown with percentages (donut chart). Only includes users with a non-null `law_school` value.

```json
[
  { "law_school": "Harvard Law School", "count": 6, "percentage": 66.7 },
  { "law_school": "Sipes-Toy Law School", "count": 1, "percentage": 11.1 }
]
```

---

### Tables

#### daily_breakdown

Comprehensive metrics combining all data sources, grouped by granularity. Returns all time periods that have any activity. Uses `date` key for multi-day periods and `hour` key for single-day periods.

**Daily granularity:**
```json
{
  "date": "2026-02-16",
  "new_users": 0,
  "new_guests": 0,
  "conversations": 10,
  "messages": 10,
  "ai_responses": 0,
  "total_tokens": 0,
  "cost": 0
}
```

**Notes:**
- `new_guests` tracks guest user signups separately from `new_users` (registered)
- `messages` in the daily breakdown counts all messages (user, assistant, and tool), unlike the `conversations_and_messages` chart which only counts user messages

#### top_universities (limit: 15)

Top universities by user count, ordered by count descending. Includes all countries.

```json
{
  "university": "KNUST",
  "count": 3,
  "percentage": 75,
  "country": "United Kingdom"
}
```

#### international_universities (limit: 15)

Same as `top_universities` but filtered to exclude users from Nigeria. Useful for tracking international adoption.

```json
{
  "university": "KNUST",
  "count": 3,
  "percentage": 100,
  "country": "United Kingdom"
}
```

**Note:** Percentages in `international_universities` are calculated relative to the international user count only, not the total.

---

## Validation & Error Responses

### 422 Validation Errors

**Invalid period value:**

```
GET /api/admin/users/analytics?period=invalid
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
GET /api/admin/users/analytics?period=date
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
GET /api/admin/users/analytics?period=date_range
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
GET /api/admin/users/analytics?period=date_range&start_date=2026-02-10&end_date=2026-02-05
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
GET /api/admin/users/analytics?period=date_range&start_date=not-a-date&end_date=also-not
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

### Currently Online Card

| Field | Type | Description |
|-------|------|-------------|
| `value` | integer | Total online users |
| `registered` | integer | Online registered users |
| `guest` | integer | Online guest users |

### New Users / Total Users Card

| Field | Type | Description |
|-------|------|-------------|
| `value` | integer | Total count |
| `registered` | integer | Registered user count |
| `guest` | integer | Guest user count |
| `change_percent` | number\|null | Percentage change from previous period |

### Activation Rate Card

| Field | Type | Description |
|-------|------|-------------|
| `ai_activation` | object | AI response activation metrics |
| `content_activation` | object | Conversation creation activation metrics |

Each sub-object:

| Field | Type | Description |
|-------|------|-------------|
| `value` | float | Activation rate as percentage |
| `activated_count` | integer | Users who activated |
| `total_signups` | integer | Total registered signups in period |
| `change_percent` | number\|null | Rate change vs previous period |

### Returning Users Card

| Field | Type | Description |
|-------|------|-------------|
| `value` | integer | Total returning users |
| `registered` | integer | Returning registered users |
| `guest` | integer | Returning guest users |
| `returning_rate` | float | Percentage of current active users who are returning |
| `change_percent` | number\|null | Change vs previous period |

### Simple Stat Card (conversations, ai_responses, tokens, cost)

| Field | Type | Description |
|-------|------|-------------|
| `value` | number | The metric value for the current period |
| `change_percent` | number\|null | Percentage change from previous period |

### User Growth Entry

| Field | Type | Description |
|-------|------|-------------|
| `date` or `hour` | string | Date (YYYY-MM-DD) or hour (`"00"`-`"23"`) |
| `total` | integer | Total new users |
| `registered` | integer | New registered users |
| `guest` | integer | New guest users |

### User Type Distribution Entry

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `Registered` or `Guest` |
| `count` | integer | Number of users of this type |
| `percentage` | float | Percentage of total |

### Active Users Over Time Entry

| Field | Type | Description |
|-------|------|-------------|
| `date` or `hour` | string | Date (YYYY-MM-DD) or hour (`"00"`-`"23"`) |
| `total` | integer | Total active users |
| `registered` | integer | Active registered users |
| `guest` | integer | Active guest users |

### Auth Provider Distribution Entry

| Field | Type | Description |
|-------|------|-------------|
| `provider` | string | Auth provider: `Email`, `Google`, `Guest` |
| `count` | integer | Number of users |
| `percentage` | float | Percentage of total |

### Conversations and Messages Entry

| Field | Type | Description |
|-------|------|-------------|
| `date` or `hour` | string | Date (YYYY-MM-DD) or hour (`"00"`-`"23"`) |
| `conversations` | integer | Number of new conversations |
| `messages` | integer | Number of user messages sent |

### Token Usage Entry

| Field | Type | Description |
|-------|------|-------------|
| `date` or `hour` | string | Date (YYYY-MM-DD) or hour (`"00"`-`"23"`) |
| `total_tokens` | integer | Total tokens consumed |

### Daily Cost Entry

| Field | Type | Description |
|-------|------|-------------|
| `date` or `hour` | string | Date (YYYY-MM-DD) or hour (`"00"`-`"23"`) |
| `cost` | float | Estimated API cost in USD |

### Profession Distribution Entry

| Field | Type | Description |
|-------|------|-------------|
| `profession` | string | User profession label |
| `count` | integer | Number of users with this profession |
| `percentage` | float | Percentage of profiled users |

### Area of Study Distribution Entry

| Field | Type | Description |
|-------|------|-------------|
| `area_of_study` | string | Area of study label |
| `count` | integer | Number of users in this field |
| `percentage` | float | Percentage of profiled users |

### Country Distribution Entry

| Field | Type | Description |
|-------|------|-------------|
| `country` | string | Country name |
| `count` | integer | Number of users from this country |
| `percentage` | float | Percentage of profiled users |

### Law School Distribution Entry

| Field | Type | Description |
|-------|------|-------------|
| `law_school` | string | Law school name or campus |
| `count` | integer | Number of users at this law school |
| `percentage` | float | Percentage of law school users |

### Daily Breakdown Entry

| Field | Type | Description |
|-------|------|-------------|
| `date` or `hour` | string | Date (YYYY-MM-DD) or hour (`"00"`-`"23"`) |
| `new_users` | integer | New registered user registrations |
| `new_guests` | integer | New guest user signups |
| `conversations` | integer | New conversations created |
| `messages` | integer | Total messages (all roles) |
| `ai_responses` | integer | AI responses generated |
| `total_tokens` | integer | Total tokens consumed |
| `cost` | float | Estimated API cost in USD |

### University Entry

| Field | Type | Description |
|-------|------|-------------|
| `university` | string | University name |
| `count` | integer | Number of users from this university |
| `percentage` | float | Percentage of total (or international total) |
| `country` | string\|null | Country of the university |

---

## Implementation Files

| File | Description |
|------|-------------|
| `app/Http/Controllers/Admin/UserController.php` | Controller with `analytics()` method |
| `app/Http/Requests/Admin/UserAnalyticsRequest.php` | Form request validation |
| `app/Services/UserAnalyticsService.php` | All query and aggregation logic |
| `routes/api.php` | Route registration (before `{uuid}` catch-all) |
| `tests/Feature/Admin/UserAnalyticsTest.php` | Pest feature tests |
