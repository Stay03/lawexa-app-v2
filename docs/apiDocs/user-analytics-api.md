# User Analytics Dashboard - API Documentation

## Overview

This endpoint provides a comprehensive user demographics and growth analytics dashboard for the admin panel. All data respects a global period selector, with automatic comparison to the equivalent previous period for change tracking.

**Key Features:**
- 5 stat cards with period-over-period change percentages
- 8 chart datasets (growth trends, usage metrics, demographic distributions)
- 3 data tables (daily breakdown, top universities, international universities)
- Period filtering: today, last 24 hours, this week, last 7 days, this month, last 30 days, single date, or custom date range
- Automatic granularity: hourly for single-day periods, daily for multi-day periods
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

Retrieve aggregated user demographics and growth analytics for the admin dashboard.

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
GET /api/admin/users/analytics?period=date_range&start_date=2026-01-01&end_date=2026-02-12
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "User analytics retrieved successfully.",
  "data": {
    "period": {
      "start": "2026-01-13T00:00:00+00:00",
      "end": "2026-02-12T04:45:44+00:00",
      "comparison_start": "2025-12-13T19:14:15+00:00",
      "comparison_end": "2026-01-12T23:59:59+00:00"
    },
    "granularity": "day",
    "stat_cards": {
      "new_users": { "value": 78, "change_percent": 100 },
      "total_conversations": { "value": 69, "change_percent": 100 },
      "total_ai_responses": { "value": 53, "change_percent": 100 },
      "total_tokens": { "value": 302087, "change_percent": 100 },
      "total_cost": { "value": 1.17, "change_percent": 100 }
    },
    "charts": {
      "user_growth": [
        { "date": "2026-01-16", "count": 3 },
        { "date": "2026-01-17", "count": 41 },
        { "date": "2026-01-21", "count": 15 },
        { "date": "2026-01-26", "count": 3 },
        { "date": "2026-01-31", "count": 4 },
        { "date": "2026-02-01", "count": 4 },
        { "date": "2026-02-09", "count": 4 },
        { "date": "2026-02-12", "count": 4 }
      ],
      "conversations_and_messages": [
        { "date": "2026-01-19", "conversations": 6, "messages": 8 },
        { "date": "2026-01-20", "conversations": 52, "messages": 65 },
        { "date": "2026-01-21", "conversations": 10, "messages": 0 },
        { "date": "2026-01-31", "conversations": 1, "messages": 0 }
      ],
      "token_usage": [
        { "date": "2026-01-19", "total_tokens": 1060 },
        { "date": "2026-01-20", "total_tokens": 301027 }
      ],
      "daily_cost": [
        { "date": "2026-01-19", "cost": 0.0002094 },
        { "date": "2026-01-20", "cost": 1.1684370000000002 }
      ],
      "profession_distribution": [
        { "profession": "Lawyer", "count": 6, "percentage": 40 },
        { "profession": "Corporate Lawyer", "count": 5, "percentage": 33.3 },
        { "profession": "Law Student", "count": 3, "percentage": 20 },
        { "profession": "Senior Lawyer", "count": 1, "percentage": 6.7 }
      ],
      "area_of_study_distribution": [],
      "country_distribution": [
        { "country": "Nigeria", "count": 10, "percentage": 76.9 },
        { "country": "United Kingdom", "count": 1, "percentage": 7.7 },
        { "country": "Saint Lucia", "count": 1, "percentage": 7.7 },
        { "country": "French Polynesia", "count": 1, "percentage": 7.7 }
      ],
      "law_school_distribution": [
        { "law_school": "Harvard Law School", "count": 6, "percentage": 66.7 },
        { "law_school": "Spencer, Marvin and Reilly Law School", "count": 1, "percentage": 11.1 },
        { "law_school": "Sipes-Toy Law School", "count": 1, "percentage": 11.1 },
        { "law_school": "Schaden Group Law School", "count": 1, "percentage": 11.1 }
      ]
    },
    "tables": {
      "daily_breakdown": [
        {
          "date": "2026-01-16",
          "new_users": 3,
          "conversations": 0,
          "messages": 0,
          "ai_responses": 0,
          "total_tokens": 0,
          "cost": 0
        },
        {
          "date": "2026-01-17",
          "new_users": 41,
          "conversations": 0,
          "messages": 0,
          "ai_responses": 0,
          "total_tokens": 0,
          "cost": 0
        },
        {
          "date": "2026-01-19",
          "new_users": 0,
          "conversations": 6,
          "messages": 16,
          "ai_responses": 7,
          "total_tokens": 1060,
          "cost": 0
        },
        {
          "date": "2026-01-20",
          "new_users": 0,
          "conversations": 52,
          "messages": 144,
          "ai_responses": 46,
          "total_tokens": 301027,
          "cost": 1.17
        }
      ],
      "top_universities": [
        {
          "university": "KNUST",
          "count": 3,
          "percentage": 75,
          "country": "United Kingdom"
        },
        {
          "university": "Queen Mary, U. of London",
          "count": 1,
          "percentage": 25,
          "country": "Nigeria"
        }
      ],
      "international_universities": [
        {
          "university": "KNUST",
          "count": 3,
          "percentage": 100,
          "country": "United Kingdom"
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
    "period": {
      "start": "2026-02-12T00:00:00+00:00",
      "end": "2026-02-12T04:45:34+00:00",
      "comparison_start": "2026-02-11T19:14:25+00:00",
      "comparison_end": "2026-02-11T23:59:59+00:00"
    },
    "granularity": "hour",
    "stat_cards": {
      "new_users": { "value": 0, "change_percent": null },
      "total_conversations": { "value": 0, "change_percent": null },
      "total_ai_responses": { "value": 0, "change_percent": null },
      "total_tokens": { "value": 0, "change_percent": null },
      "total_cost": { "value": 0, "change_percent": null }
    },
    "charts": {
      "user_growth": [],
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
- Demographic distributions only include non-null, non-empty values

---

## Response Structure

### Stat Cards

| Card | Source | Calculation | Unit |
|------|--------|-------------|------|
| `new_users` | `users` | `COUNT(*)` excluding bot/system | integer |
| `total_conversations` | `conversations` | `COUNT(*)` | integer |
| `total_ai_responses` | `ai_responses` | `COUNT(*)` | integer |
| `total_tokens` | `ai_responses` | `SUM(total_tokens)` | integer |
| `total_cost` | `ai_responses` | `SUM(estimated_cost)` | USD |

Each card returns:
```json
{
  "value": 78,
  "change_percent": 100.0
}
```

### Charts

#### user_growth
New user registration counts (bar chart). Key changes based on granularity.

**Daily granularity (multi-day periods):**
```json
[
  { "date": "2026-01-17", "count": 41 },
  { "date": "2026-01-21", "count": 15 }
]
```

**Hourly granularity (single-day periods):**
```json
[
  { "hour": "09", "count": 3 },
  { "hour": "14", "count": 1 }
]
```

#### conversations_and_messages
New conversations overlaid with user message counts (dual-line chart). Key changes based on granularity.

**Daily granularity:**
```json
[{ "date": "2026-01-20", "conversations": 52, "messages": 65 }]
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
  { "profession": "Lawyer", "count": 6, "percentage": 40 },
  { "profession": "Corporate Lawyer", "count": 5, "percentage": 33.3 },
  { "profession": "Law Student", "count": 3, "percentage": 20 }
]
```

#### area_of_study_distribution
User breakdown by area of study with percentages (donut chart).

```json
[
  { "area_of_study": "Law", "count": 248, "percentage": 99.2 },
  { "area_of_study": "Accounting", "count": 1, "percentage": 0.4 }
]
```

#### country_distribution
Geographic distribution of users with percentages (horizontal bar chart).

```json
[
  { "country": "Nigeria", "count": 10, "percentage": 76.9 },
  { "country": "United Kingdom", "count": 1, "percentage": 7.7 }
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

### Tables

#### daily_breakdown

Comprehensive metrics combining all data sources, grouped by granularity. Returns all time periods that have any activity. Uses `date` key for multi-day periods and `hour` key for single-day periods.

**Daily granularity:**
```json
{
  "date": "2026-01-20",
  "new_users": 0,
  "conversations": 52,
  "messages": 144,
  "ai_responses": 46,
  "total_tokens": 301027,
  "cost": 1.17
}
```

**Note:** `messages` in the daily breakdown table counts all messages (user, assistant, and tool), unlike the `conversations_and_messages` chart which only counts user messages.

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

### Stat Card Object

| Field | Type | Description |
|-------|------|-------------|
| `value` | number | The metric value for the current period |
| `change_percent` | number\|null | Percentage change from previous period. `null` when no data in either period |

### User Growth Entry

| Field | Type | Description |
|-------|------|-------------|
| `date` or `hour` | string | Date (YYYY-MM-DD) for daily granularity, or hour (`"00"`-`"23"`) for hourly |
| `count` | integer | Number of new user registrations |

### Conversations and Messages Entry

| Field | Type | Description |
|-------|------|-------------|
| `date` or `hour` | string | Date (YYYY-MM-DD) for daily granularity, or hour (`"00"`-`"23"`) for hourly |
| `conversations` | integer | Number of new conversations |
| `messages` | integer | Number of user messages sent |

### Token Usage Entry

| Field | Type | Description |
|-------|------|-------------|
| `date` or `hour` | string | Date (YYYY-MM-DD) for daily granularity, or hour (`"00"`-`"23"`) for hourly |
| `total_tokens` | integer | Total tokens consumed |

### Daily Cost Entry

| Field | Type | Description |
|-------|------|-------------|
| `date` or `hour` | string | Date (YYYY-MM-DD) for daily granularity, or hour (`"00"`-`"23"`) for hourly |
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
| `date` or `hour` | string | Date (YYYY-MM-DD) for daily granularity, or hour (`"00"`-`"23"`) for hourly |
| `new_users` | integer | New user registrations |
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
| No params (defaults to last_30_days) | 200 | day | Full charts and tables |
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
| `app/Http/Controllers/Admin/UserController.php` | Controller with `analytics()` method |
| `app/Http/Requests/Admin/UserAnalyticsRequest.php` | Form request validation |
| `app/Services/UserAnalyticsService.php` | All query and aggregation logic |
| `routes/api.php` | Route registration (before `{uuid}` catch-all) |
| `tests/Feature/Admin/UserAnalyticsTest.php` | 32 Pest feature tests |
