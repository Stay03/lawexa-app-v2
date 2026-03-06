# Subscription Analytics Dashboard - API Documentation

## Overview

This endpoint provides a comprehensive subscription analytics dashboard for the admin panel. All data respects a global period selector, with automatic comparison to the equivalent previous period for change tracking.

**Key Features:**
- 8 stat cards with period-over-period change percentages
- 6 chart datasets (growth trends, revenue, MRR, plan/status distributions, churn)
- 3 data tables (plan breakdown, recent subscriptions, top revenue users)
- Period filtering: today, last 24 hours, this week, last 7 days, this month, last 30 days, single date, or custom date range (max 366 days)
- Automatic granularity: hourly for single-day periods, daily for multi-day periods
- MRR normalization across different plan intervals (daily, monthly, annually)

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Subscription Analytics](#subscription-analytics)
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
| `/api/admin/subscriptions/analytics` | GET | Yes | Admin |

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

## Subscription Analytics

### GET /api/admin/subscriptions/analytics

Retrieve aggregated subscription metrics, revenue analytics, and churn data for the admin dashboard.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `last_30_days` | Period preset (see [Period Presets](#period-presets) table) |
| `date` | date | - | Required when `period=date`. Format: `Y-m-d` |
| `start_date` | date | - | Required when `period=date_range`. Format: `Y-m-d` |
| `end_date` | date | - | Required when `period=date_range`. Format: `Y-m-d`. Max 366 days from `start_date` |

**Example Requests:**

```
GET /api/admin/subscriptions/analytics
GET /api/admin/subscriptions/analytics?period=today
GET /api/admin/subscriptions/analytics?period=last_24_hours
GET /api/admin/subscriptions/analytics?period=last_7_days
GET /api/admin/subscriptions/analytics?period=this_week
GET /api/admin/subscriptions/analytics?period=this_month
GET /api/admin/subscriptions/analytics?period=last_30_days
GET /api/admin/subscriptions/analytics?period=date&date=2026-03-06
GET /api/admin/subscriptions/analytics?period=date_range&start_date=2026-01-01&end_date=2026-03-06
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Subscription analytics retrieved successfully.",
  "data": {
    "period": {
      "start": "2026-02-04T00:00:00+00:00",
      "end": "2026-03-06T20:25:58+00:00",
      "comparison_start": "2026-01-04T03:34:01+00:00",
      "comparison_end": "2026-02-03T23:59:59+00:00"
    },
    "granularity": "day",
    "stat_cards": {
      "total_subscriptions": { "value": 9, "change_percent": 100 },
      "active_subscriptions": { "value": 7, "change_percent": 100 },
      "new_subscriptions": { "value": 9, "change_percent": 100 },
      "churned_subscriptions": { "value": 2, "change_percent": 100 },
      "mrr": { "value": 56073.97, "change_percent": 100 },
      "revenue": { "value": 183900, "change_percent": 1126 },
      "churn_rate": { "value": null, "change_percent": null },
      "avg_revenue_per_user": { "value": 45975, "change_percent": 206.5 }
    },
    "charts": {
      "subscriptions_over_time": [
        { "date": "2026-03-05", "count": 1 },
        { "date": "2026-03-06", "count": 8 }
      ],
      "revenue_over_time": [
        { "date": "2026-02-14", "revenue": 4900 },
        { "date": "2026-02-19", "revenue": 15000 },
        { "date": "2026-02-24", "revenue": 15000 },
        { "date": "2026-03-04", "revenue": 149000 }
      ],
      "mrr_trend": [
        { "date": "2026-02-04", "mrr": 0 },
        { "date": "2026-03-05", "mrr": 4027.4 },
        { "date": "2026-03-06", "mrr": 60973.97 }
      ],
      "plan_distribution": [
        { "plan_name": "Pro Monthly", "count": 2, "percentage": 33.3, "total_amount": 30000 },
        { "plan_name": "Free", "count": 1, "percentage": 16.7, "total_amount": 0 },
        { "plan_name": "Pro Annually", "count": 1, "percentage": 16.7, "total_amount": 149000 }
      ],
      "status_distribution": [
        { "status": "active", "label": "Active", "count": 6, "percentage": 66.7 },
        { "status": "cancelled", "label": "Cancelled", "count": 1, "percentage": 11.1 },
        { "status": "expired", "label": "Expired", "count": 1, "percentage": 11.1 },
        { "status": "past_due", "label": "Past Due", "count": 1, "percentage": 11.1 }
      ],
      "churn_over_time": [
        { "date": "2026-02-24", "count": 1 },
        { "date": "2026-03-01", "count": 1 }
      ]
    },
    "tables": {
      "plan_breakdown": [
        {
          "plan_name": "Pro Monthly",
          "active_count": 2,
          "new_in_period": 3,
          "churned_in_period": 1,
          "revenue_in_period": 30000,
          "mrr_contribution": 30000
        }
      ],
      "recent_subscriptions": [
        {
          "id": 12,
          "user_name": "Analytics Test User 1",
          "user_email": "analytics-test1@test.com",
          "user_uuid": "537de72f-a26e-4219-91fd-b3da3f1922a6",
          "plan_name": "Pro Monthly",
          "status": "active",
          "status_label": "Active",
          "amount": 15000,
          "currency": "NGN",
          "created_at": "2026-03-06T19:13:07+00:00"
        }
      ],
      "top_revenue_users": [
        {
          "user_uuid": "3143dc05-ee68-4b9c-9d9b-5bff71452f61",
          "user_name": "Analytics Test User 4",
          "user_email": "analytics-test4@test.com",
          "total_revenue": 149000,
          "invoice_count": 1
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
| Date Range | `date_range` | Day | `start_date` to `end_date` (max 366 days) | Equivalent duration immediately prior |

### Granularity

The `granularity` field in the response indicates how time-series data is grouped:

- **`hour`** — Single-day periods (`today`, `last_24_hours`, `date`). Time-series charts use `date` as the key with datetime values (format: `YYYY-MM-DD HH:00`).
- **`day`** — Multi-day periods (`this_week`, `last_7_days`, `this_month`, `last_30_days`, `date_range`). Time-series charts use `date` as the key (format: `YYYY-MM-DD`).

**Hourly granularity example:**
```json
{ "date": "2026-03-06 14:00", "count": 3 }
```

**Daily granularity example:**
```json
{ "date": "2026-03-06", "count": 8 }
```

### Change Percent Calculation

Each stat card includes a `change_percent` comparing the current period to the previous period:

| Scenario | Result |
|----------|--------|
| Previous = 0, Current > 0 | `100.0` (new activity) |
| Previous = 0, Current = 0 | `null` (no data) |
| Previous > 0, Current > 0 | `((current - previous) / previous) * 100` |

**Special case — `churn_rate`:** When there are no active subscriptions at the start of the period, `churn_rate.value` is `null` (undefined rate) regardless of how many subscriptions churned.

**Empty State (no period-specific data):**

```json
{
  "success": true,
  "message": "Subscription analytics retrieved successfully.",
  "data": {
    "period": { "start": "...", "end": "...", "comparison_start": "...", "comparison_end": "..." },
    "granularity": "day",
    "stat_cards": {
      "total_subscriptions": { "value": 0, "change_percent": null },
      "active_subscriptions": { "value": 0, "change_percent": null },
      "new_subscriptions": { "value": 0, "change_percent": null },
      "churned_subscriptions": { "value": 0, "change_percent": null },
      "mrr": { "value": 0, "change_percent": null },
      "revenue": { "value": 0, "change_percent": null },
      "churn_rate": { "value": null, "change_percent": null },
      "avg_revenue_per_user": { "value": 0, "change_percent": null }
    },
    "charts": {
      "subscriptions_over_time": [],
      "revenue_over_time": [],
      "mrr_trend": [],
      "plan_distribution": [],
      "status_distribution": [],
      "churn_over_time": []
    },
    "tables": {
      "plan_breakdown": [],
      "recent_subscriptions": [],
      "top_revenue_users": []
    }
  }
}
```

---

## Response Structure

### Stat Cards

| Card | Source | Calculation | Type | Unit |
|------|--------|-------------|------|------|
| `total_subscriptions` | `subscriptions` | `COUNT(*)` (lifetime snapshot) | Snapshot | integer |
| `active_subscriptions` | `subscriptions` | `COUNT(*)` where status in (active, past_due, trialing) | Snapshot | integer |
| `new_subscriptions` | `subscriptions` | `COUNT(*)` created in period | Period | integer |
| `churned_subscriptions` | `subscriptions` | `COUNT(*)` cancelled or expired in period | Period | integer |
| `mrr` | `subscriptions` + `plans` | `SUM(amount * 30 / interval_days)` for active paid subs | Snapshot | NGN |
| `revenue` | `subscription_invoices` | `SUM(amount)` where paid in period | Period | NGN |
| `churn_rate` | derived | `(churned / active_at_start) * 100` | Period | percent |
| `avg_revenue_per_user` | `subscription_invoices` | `revenue / distinct_paying_users` in period | Period | NGN |

**Snapshot vs Period:**
- **Snapshot** stats reflect the current state of the system (not bound to the selected period). Their `change_percent` compares the current value to what it was at the end of the previous comparison period.
- **Period** stats are scoped to the selected time range. Their `change_percent` compares the current period to the equivalent previous period.

Each card returns:
```json
{
  "value": 56073.97,
  "change_percent": 100.0
}
```

### Charts

#### subscriptions_over_time
New subscription creation counts over time (bar chart).

**Daily granularity:**
```json
[
  { "date": "2026-03-05", "count": 1 },
  { "date": "2026-03-06", "count": 8 }
]
```

**Hourly granularity:**
```json
[
  { "date": "2026-03-06 00:00", "count": 1 },
  { "date": "2026-03-06 19:00", "count": 7 }
]
```

#### revenue_over_time
Paid invoice revenue over time (bar chart). Only includes invoices where `paid = true`.

**Daily granularity:**
```json
[
  { "date": "2026-02-14", "revenue": 4900 },
  { "date": "2026-03-04", "revenue": 149000 }
]
```

**Hourly granularity:**
```json
[
  { "date": "2026-03-06 10:00", "revenue": 15000 }
]
```

#### mrr_trend
Monthly Recurring Revenue at each point in time (line chart). One data point per day (or per hour for hourly granularity). MRR is calculated by normalizing all active paid subscription amounts to a 30-day equivalent using the plan's interval.

**Formula:** `SUM(subscription_amount * 30 / plan_interval_days)` for active/past_due/trialing subscriptions at each point.

**Interval normalization:**

| Plan Interval | Days | Monthly (30k) → MRR |
|---------------|------|---------------------|
| daily | 1 | 30,000 * 30 / 1 = 900,000 |
| weekly | 7 | 30,000 * 30 / 7 = 128,571 |
| monthly | 30 | 30,000 * 30 / 30 = 30,000 |
| quarterly | 91 | 30,000 * 30 / 91 = 9,890 |
| biannually | 182 | 30,000 * 30 / 182 = 4,945 |
| annually | 365 | 30,000 * 30 / 365 = 2,466 |

```json
[
  { "date": "2026-03-05", "mrr": 4027.4 },
  { "date": "2026-03-06", "mrr": 60973.97 }
]
```

#### plan_distribution
Distribution of currently active subscriptions by plan (donut chart). Snapshot — not affected by period.

```json
[
  { "plan_name": "Pro Monthly", "count": 2, "percentage": 33.3, "total_amount": 30000 },
  { "plan_name": "Free", "count": 1, "percentage": 16.7, "total_amount": 0 }
]
```

**Note:** `total_amount` is the sum of subscription face values for active subs on that plan, not actual paid revenue.

#### status_distribution
Distribution of all subscriptions by status (donut chart). Snapshot — not affected by period.

```json
[
  { "status": "active", "label": "Active", "count": 6, "percentage": 66.7 },
  { "status": "cancelled", "label": "Cancelled", "count": 1, "percentage": 11.1 },
  { "status": "expired", "label": "Expired", "count": 1, "percentage": 11.1 },
  { "status": "past_due", "label": "Past Due", "count": 1, "percentage": 11.1 }
]
```

**Possible statuses:** `active`, `past_due`, `cancelled`, `expired`, `trialing`

#### churn_over_time
Cancellation and expiration counts over time (bar chart). Combines cancelled subscriptions (by `cancelled_at`) and expired subscriptions (by `ends_at`) in the period.

```json
[
  { "date": "2026-02-24", "count": 1 },
  { "date": "2026-03-01", "count": 1 }
]
```

### Tables

#### plan_breakdown

Per-plan metrics combining snapshot and period data. Includes all active plans plus any inactive plans that still have subscriptions. Ordered by `sort_order`.

```json
{
  "plan_name": "Pro Monthly",
  "active_count": 2,
  "new_in_period": 3,
  "churned_in_period": 1,
  "revenue_in_period": 30000,
  "mrr_contribution": 30000
}
```

| Field | Description |
|-------|-------------|
| `active_count` | Currently active/past_due/trialing subscriptions (snapshot) |
| `new_in_period` | Subscriptions created in the selected period |
| `churned_in_period` | Cancelled or expired in the selected period |
| `revenue_in_period` | Paid invoice sum in the selected period |
| `mrr_contribution` | Current MRR from active paid subs on this plan |

#### recent_subscriptions (limit: 15)

Latest 15 subscriptions ordered by `created_at` DESC. Includes user and plan details. Not filtered by period.

```json
{
  "id": 12,
  "user_name": "Analytics Test User 1",
  "user_email": "analytics-test1@test.com",
  "user_uuid": "537de72f-a26e-4219-91fd-b3da3f1922a6",
  "plan_name": "Pro Monthly",
  "status": "active",
  "status_label": "Active",
  "amount": 15000,
  "currency": "NGN",
  "created_at": "2026-03-06T19:13:07+00:00"
}
```

#### top_revenue_users (limit: 10)

Top 10 users by paid invoice revenue in the selected period. Ordered by `total_revenue` DESC.

```json
{
  "user_uuid": "3143dc05-ee68-4b9c-9d9b-5bff71452f61",
  "user_name": "Analytics Test User 4",
  "user_email": "analytics-test4@test.com",
  "total_revenue": 149000,
  "invoice_count": 1
}
```

---

## Validation & Error Responses

### 422 Validation Errors

**Invalid period value:**

```
GET /api/admin/subscriptions/analytics?period=invalid
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
GET /api/admin/subscriptions/analytics?period=date
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
GET /api/admin/subscriptions/analytics?period=date_range
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
GET /api/admin/subscriptions/analytics?period=date_range&start_date=2026-03-10&end_date=2026-03-01
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

**Date range exceeding 366 days:**

```
GET /api/admin/subscriptions/analytics?period=date_range&start_date=2024-01-01&end_date=2025-06-01
```

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
| `value` | number\|null | The metric value. `null` for `churn_rate` when undefined |
| `change_percent` | number\|null | Percentage change from previous period. `null` when no data in either period |

### Subscriptions Over Time Entry

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | `YYYY-MM-DD` for daily, `YYYY-MM-DD HH:00` for hourly |
| `count` | integer | Number of new subscriptions created |

### Revenue Over Time Entry

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | `YYYY-MM-DD` for daily, `YYYY-MM-DD HH:00` for hourly |
| `revenue` | float | Total paid invoice amount (NGN) |

### MRR Trend Entry

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | `YYYY-MM-DD` for daily, `YYYY-MM-DD HH:00` for hourly |
| `mrr` | float | Monthly Recurring Revenue at that point (NGN) |

### Plan Distribution Entry

| Field | Type | Description |
|-------|------|-------------|
| `plan_name` | string | Plan name |
| `count` | integer | Number of active subscriptions |
| `percentage` | float | Percentage of total active subscriptions |
| `total_amount` | float | Sum of subscription amounts for active subs (NGN) |

### Status Distribution Entry

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Status enum value (`active`, `past_due`, `cancelled`, `expired`, `trialing`) |
| `label` | string | Human-readable status label |
| `count` | integer | Number of subscriptions with this status |
| `percentage` | float | Percentage of total subscriptions |

### Churn Over Time Entry

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | `YYYY-MM-DD` for daily, `YYYY-MM-DD HH:00` for hourly |
| `count` | integer | Combined cancelled + expired subscriptions |

### Plan Breakdown Entry

| Field | Type | Description |
|-------|------|-------------|
| `plan_name` | string | Plan name |
| `active_count` | integer | Currently active/past_due/trialing (snapshot) |
| `new_in_period` | integer | Created in the selected period |
| `churned_in_period` | integer | Cancelled or expired in the selected period |
| `revenue_in_period` | float | Paid invoice revenue in the selected period (NGN) |
| `mrr_contribution` | float | Current MRR contribution from this plan (NGN) |

### Recent Subscription Entry

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Subscription ID |
| `user_name` | string | User's full name |
| `user_email` | string | User's email address |
| `user_uuid` | string | User's UUID |
| `plan_name` | string | Plan name |
| `status` | string | Status enum value |
| `status_label` | string | Human-readable status |
| `amount` | float | Subscription amount (NGN) |
| `currency` | string | Currency code |
| `created_at` | datetime | Subscription creation date (ISO 8601) |

### Top Revenue User Entry

| Field | Type | Description |
|-------|------|-------------|
| `user_uuid` | string | User's UUID |
| `user_name` | string | User's full name |
| `user_email` | string | User's email address |
| `total_revenue` | float | Total paid invoice revenue in period (NGN) |
| `invoice_count` | integer | Number of paid invoices in period |

---

## Curl Test Results

All tests performed against local dev server on 2026-03-06.

### Authentication & Authorization

| Test | Status | Response |
|------|--------|----------|
| No auth token | 401 | `Unauthenticated.` |
| Regular user (non-admin) | 403 | `Insufficient permissions. This action requires at least admin role.` |
| Admin user | 200 | Success |

### Period Validation

| Test | Status | Response |
|------|--------|----------|
| `?period=invalid` | 422 | `Period must be: today, last_24_hours, date, this_week, last_7_days, this_month, last_30_days, or date_range.` |
| `?period=date` (no date param) | 422 | `Date is required when using the date period.` |
| `?period=date_range` (no dates) | 422 | `Start date is required when using date_range period.` |
| `?period=date_range&start_date=2026-03-10&end_date=2026-03-01` | 422 | `Start date must be before or equal to end date.` |
| `?period=date_range&start_date=2024-01-01&end_date=2025-06-01` | 422 | `The date range must not exceed 366 days.` |

### Happy Path Periods

| Test | Status | Granularity | Notes |
|------|--------|-------------|-------|
| No params (defaults to last_30_days) | 200 | day | Full charts and tables |
| `?period=today` | 200 | hour | Hourly breakdown of today's data |
| `?period=last_24_hours` | 200 | hour | Rolling 24-hour window with unique datetime labels |
| `?period=date&date=2026-03-06` | 200 | hour | Specific day with hourly breakdown |
| `?period=this_week` | 200 | day | Current week data |
| `?period=last_7_days` | 200 | day | Rolling 7-day window |
| `?period=this_month` | 200 | day | Current month data |
| `?period=last_30_days` | 200 | day | Rolling 30-day window |
| `?period=date_range&start_date=2026-01-01&end_date=2026-03-06` | 200 | day | Custom range with comparison period |

---

## Implementation Files

| File | Description |
|------|-------------|
| `app/Http/Controllers/Admin/SubscriptionController.php` | Controller with `analytics()` method |
| `app/Http/Requests/Admin/SubscriptionAnalyticsRequest.php` | Form request validation (period, date range max 366 days) |
| `app/Services/SubscriptionAnalyticsService.php` | All query and aggregation logic |
| `routes/api.php` | Route registration under `admin/subscriptions` prefix |
| `tests/Feature/Admin/SubscriptionAnalyticsTest.php` | 54 Pest feature tests (207 assertions) |
