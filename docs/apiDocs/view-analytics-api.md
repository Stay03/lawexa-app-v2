# View Analytics Dashboard - API Documentation

## Overview

This endpoint provides a comprehensive views analytics dashboard for the admin panel. All metrics are centered on the `views` table, enriched with `users` and `user_profiles` data via joins. The endpoint supports multiple duration presets with automatic granularity (hours for single-day periods, days for multi-day periods), with percentage change comparison against the previous equivalent period.

**Key Features:**
- 8 stat cards with period-over-period change percentages
- 11 chart datasets (time series, distributions, geographic, demographic)
- 7 data tables (top content, viewers, search queries, bot activity, cities, universities)
- Period filtering: today, last 24 hours, this week, last 7 days, this month, last 30 days, single date, or custom date range
- Automatic granularity: hourly for single-day periods, daily for multi-day periods
- Human vs bot traffic separation throughout

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [View Analytics](#view-analytics)
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
| `/api/admin/views/analytics` | GET | Yes | Admin |

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

## View Analytics

### GET /api/admin/views/analytics

Retrieve aggregated view analytics data for the admin dashboard.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `last_30_days` | Period preset (see table below) |
| `date` | date | - | Required when `period=date`. Format: `Y-m-d` |
| `start_date` | date | - | Required when `period=date_range`. Format: `Y-m-d` |
| `end_date` | date | - | Required when `period=date_range`. Format: `Y-m-d` |

**Example Requests:**

```
GET /api/admin/views/analytics
GET /api/admin/views/analytics?period=today
GET /api/admin/views/analytics?period=last_24_hours
GET /api/admin/views/analytics?period=last_7_days
GET /api/admin/views/analytics?period=this_week
GET /api/admin/views/analytics?period=this_month
GET /api/admin/views/analytics?period=last_30_days
GET /api/admin/views/analytics?period=date&date=2026-02-10
GET /api/admin/views/analytics?period=date_range&start_date=2026-01-01&end_date=2026-02-15
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "View analytics retrieved successfully.",
  "data": {
    "period": {
      "start": "2026-01-17T00:00:00+00:00",
      "end": "2026-02-16T04:00:00+00:00",
      "comparison_start": "2025-12-17T18:00:00+00:00",
      "comparison_end": "2026-01-16T23:59:59+00:00"
    },
    "granularity": "day",
    "stat_cards": {
      "total_views": { "value": 245, "change_percent": 100 },
      "unique_visitors": { "value": 38, "change_percent": 100 },
      "human_views": { "value": 210, "change_percent": 100 },
      "bot_views": { "value": 35, "change_percent": 100 },
      "search_engine_crawls": { "value": 18, "change_percent": 100 },
      "social_media_crawls": { "value": 12, "change_percent": 100 },
      "internal_search_views": { "value": 42, "change_percent": 100 },
      "countries_reached": { "value": 7, "change_percent": 100 }
    },
    "charts": {
      "views_over_time": [
        { "date": "2026-01-20", "human_views": 15, "bot_views": 3, "total_views": 18 }
      ],
      "views_by_content_type": [
        { "type": "case", "count": 180, "percentage": 73.5 },
        { "type": "note", "count": 65, "percentage": 26.5 }
      ],
      "device_breakdown": [
        { "device_type": "desktop", "count": 120, "percentage": 57.1 },
        { "device_type": "mobile", "count": 75, "percentage": 35.7 },
        { "device_type": "tablet", "count": 15, "percentage": 7.1 }
      ],
      "browser_usage": [
        { "browser": "Chrome", "count": 100, "percentage": 47.6 },
        { "browser": "Safari", "count": 60, "percentage": 28.6 },
        { "browser": "Firefox", "count": 50, "percentage": 23.8 }
      ],
      "human_vs_bot": [
        { "category": "human", "count": 210, "percentage": 85.7 },
        { "category": "bot", "count": 35, "percentage": 14.3 }
      ],
      "bot_breakdown": [
        { "category": "search_engine", "count": 18, "percentage": 51.4 },
        { "category": "social_media", "count": 12, "percentage": 34.3 },
        { "category": "other", "count": 5, "percentage": 14.3 }
      ],
      "views_by_country": [
        { "country": "Nigeria", "count": 150 },
        { "country": "United Kingdom", "count": 30 }
      ],
      "views_by_continent": [
        { "continent": "Africa", "count": 170 },
        { "continent": "Europe", "count": 40 }
      ],
      "views_by_profession": [
        { "profession": "Lawyer", "count": 80, "percentage": 50.0 },
        { "profession": "Law Student", "count": 50, "percentage": 31.3 },
        { "profession": "Barrister", "count": 30, "percentage": 18.8 }
      ],
      "profile_country_vs_ip_country": {
        "profile_countries": [
          { "country": "Nigeria", "count": 120 },
          { "country": "Ghana", "count": 20 }
        ],
        "ip_countries": [
          { "country": "Nigeria", "count": 130 },
          { "country": "United Kingdom", "count": 15 }
        ]
      },
      "views_by_university": [
        { "university": "University of Lagos", "count": 40, "percentage": 33.3 },
        { "university": "KNUST", "count": 25, "percentage": 20.8 }
      ]
    },
    "tables": {
      "top_viewed_content": [
        { "viewable_type": "case", "viewable_id": 42, "view_count": 28 }
      ],
      "recent_views": [
        {
          "viewer_name": "Stay Njokede",
          "profession": "Lawyer",
          "profile_country": "Nigeria",
          "viewable_type": "case",
          "device_type": "desktop",
          "browser": "Chrome",
          "ip_country": "Nigeria",
          "is_bot": false,
          "viewed_at": "2026-02-16T03:45:00+00:00"
        }
      ],
      "top_viewers": [
        {
          "uuid": "af8085d5-89a9-4e1e-9578-f06c26d37120",
          "name": "Stay Njokede",
          "email": "stay@example.com",
          "profession": "Lawyer",
          "view_count": 15
        }
      ],
      "top_search_queries": [
        { "search_query": "contract law", "count": 8 },
        { "search_query": "election petition", "count": 5 }
      ],
      "bot_activity": [
        {
          "bot_name": "Googlebot",
          "bot_type": "search_engine",
          "viewable_type": "case",
          "viewed_at": "2026-02-16T02:30:00+00:00"
        }
      ],
      "views_by_city": [
        { "city": "Lagos", "region": "Lagos", "country": "Nigeria", "count": 85 },
        { "city": "Accra", "region": "Greater Accra", "country": "Ghana", "count": 20 }
      ],
      "top_universities": [
        { "university": "University of Lagos", "view_count": 40, "unique_viewers": 12 }
      ]
    }
  }
}
```

---

## Period Filtering

All dashboard components respect the global period selector. When the period changes, **every** stat card, chart, and table updates to reflect data within that period.

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

- **`hour`** — Single-day periods (`today`, `last_24_hours`, `date`). The `views_over_time` chart uses `hour` as the key (values: `"00"` to `"23"`).
- **`day`** — Multi-day periods (`this_week`, `last_7_days`, `this_month`, `last_30_days`, `date_range`). The `views_over_time` chart uses `date` as the key (format: `YYYY-MM-DD`).

### Change Percent Calculation

Each stat card includes a `change_percent` comparing the current period to the previous period:

| Scenario | Result |
|----------|--------|
| Previous = 0, Current > 0 | `100.0` (new activity) |
| Previous = 0, Current = 0 | `null` (no data) |
| Previous > 0, Current > 0 | `((current - previous) / previous) * 100`, rounded to 1 decimal |
| Previous > 0, Current = 0 | `-100.0` |

**Empty State (no data in period):**

```json
{
  "success": true,
  "message": "View analytics retrieved successfully.",
  "data": {
    "period": {
      "start": "2026-02-16T00:00:00+00:00",
      "end": "2026-02-16T04:00:00+00:00",
      "comparison_start": "2026-02-15T20:00:00+00:00",
      "comparison_end": "2026-02-15T23:59:59+00:00"
    },
    "granularity": "hour",
    "stat_cards": {
      "total_views": { "value": 0, "change_percent": null },
      "unique_visitors": { "value": 0, "change_percent": null },
      "human_views": { "value": 0, "change_percent": null },
      "bot_views": { "value": 0, "change_percent": null },
      "search_engine_crawls": { "value": 0, "change_percent": null },
      "social_media_crawls": { "value": 0, "change_percent": null },
      "internal_search_views": { "value": 0, "change_percent": null },
      "countries_reached": { "value": 0, "change_percent": null }
    },
    "charts": {
      "views_over_time": [],
      "views_by_content_type": [],
      "device_breakdown": [],
      "browser_usage": [],
      "human_vs_bot": [],
      "bot_breakdown": [],
      "views_by_country": [],
      "views_by_continent": [],
      "views_by_profession": [],
      "profile_country_vs_ip_country": { "profile_countries": [], "ip_countries": [] },
      "views_by_university": []
    },
    "tables": {
      "top_viewed_content": [],
      "recent_views": [],
      "top_viewers": [],
      "top_search_queries": [],
      "bot_activity": [],
      "views_by_city": [],
      "top_universities": []
    }
  }
}
```

---

## Response Structure

### Stat Cards

| Card | Calculation | Description |
|------|-------------|-------------|
| `total_views` | `COUNT(*)` | Total page views in the period |
| `unique_visitors` | `COUNT(DISTINCT user_id)` | Distinct authenticated users who viewed content |
| `human_views` | `COUNT(*) WHERE is_bot = 0` | Views from real users (excludes bots) |
| `bot_views` | `COUNT(*) WHERE is_bot = 1` | Views from bots/crawlers |
| `search_engine_crawls` | `COUNT(*) WHERE is_search_engine = 1` | Bot views from search engines (Googlebot, Bingbot, etc.) |
| `social_media_crawls` | `COUNT(*) WHERE is_social_media = 1` | Bot views from social media crawlers (FacebookExternalHit, Twitterbot, etc.) |
| `internal_search_views` | `COUNT(*) WHERE is_from_search = 1` | Views where the user arrived via internal app search (`?q=` parameter) |
| `countries_reached` | `COUNT(DISTINCT ip_country_code)` | Number of distinct countries from which views originated |

Each card returns:
```json
{
  "value": 245,
  "change_percent": 100.0
}
```

### Charts

#### views_over_time
Time-series view counts split by human and bot traffic. Key changes based on granularity.

**Daily granularity (multi-day periods):**
```json
[{ "date": "2026-01-20", "human_views": 15, "bot_views": 3, "total_views": 18 }]
```

**Hourly granularity (single-day periods):**
```json
[{ "hour": "10", "human_views": 5, "bot_views": 1, "total_views": 6 }]
```

#### views_by_content_type
View distribution by content type (case, note, etc.) with percentages.

```json
[
  { "type": "case", "count": 180, "percentage": 73.5 },
  { "type": "note", "count": 65, "percentage": 26.5 }
]
```

#### device_breakdown
Device type distribution for **human views only** (bots excluded).

```json
[
  { "device_type": "desktop", "count": 120, "percentage": 57.1 },
  { "device_type": "mobile", "count": 75, "percentage": 35.7 },
  { "device_type": "tablet", "count": 15, "percentage": 7.1 }
]
```

#### browser_usage
Browser distribution for **human views only** (bots excluded).

```json
[
  { "browser": "Chrome", "count": 100, "percentage": 47.6 },
  { "browser": "Safari", "count": 60, "percentage": 28.6 },
  { "browser": "Firefox", "count": 50, "percentage": 23.8 }
]
```

#### human_vs_bot
Overall split between human and bot traffic.

```json
[
  { "category": "human", "count": 210, "percentage": 85.7 },
  { "category": "bot", "count": 35, "percentage": 14.3 }
]
```

#### bot_breakdown
Bot traffic categorized into search engines, social media crawlers, and other bots.

```json
[
  { "category": "search_engine", "count": 18, "percentage": 51.4 },
  { "category": "social_media", "count": 12, "percentage": 34.3 },
  { "category": "other", "count": 5, "percentage": 14.3 }
]
```

**Bot Categories:**

| Category | Condition |
|----------|-----------|
| `search_engine` | `is_bot = 1 AND is_search_engine = 1` (Googlebot, Bingbot, YandexBot, DuckDuckBot) |
| `social_media` | `is_bot = 1 AND is_social_media = 1` (FacebookExternalHit, Twitterbot, LinkedInBot, WhatsApp) |
| `other` | `is_bot = 1 AND is_search_engine = 0 AND is_social_media = 0` |

#### views_by_country
Geographic distribution by IP country (top 15).

```json
[
  { "country": "Nigeria", "count": 150 },
  { "country": "United Kingdom", "count": 30 }
]
```

#### views_by_continent
Geographic distribution by IP continent.

```json
[
  { "continent": "Africa", "count": 170 },
  { "continent": "Europe", "count": 40 }
]
```

#### views_by_profession
View distribution by viewer's profession from their user profile. **Human views only** (bots excluded). Only includes viewers who have a profile with a non-empty profession.

```json
[
  { "profession": "Lawyer", "count": 80, "percentage": 50.0 },
  { "profession": "Law Student", "count": 50, "percentage": 31.3 }
]
```

#### profile_country_vs_ip_country
Comparison of where users say they're from (profile country) vs where they're actually browsing from (IP country). **Human views only** (bots excluded). Top 10 each.

```json
{
  "profile_countries": [
    { "country": "Nigeria", "count": 120 },
    { "country": "Ghana", "count": 20 }
  ],
  "ip_countries": [
    { "country": "Nigeria", "count": 130 },
    { "country": "United Kingdom", "count": 15 }
  ]
}
```

#### views_by_university
View distribution by viewer's university from their user profile. **Human views only** (bots excluded). Only includes viewers who have a profile with a non-empty university.

```json
[
  { "university": "University of Lagos", "count": 40, "percentage": 33.3 },
  { "university": "KNUST", "count": 25, "percentage": 20.8 }
]
```

### Tables

#### top_viewed_content (limit: 10)

Most viewed content items by human view count, grouped by type and ID. **Excludes bot views.**

```json
{
  "viewable_type": "case",
  "viewable_id": 42,
  "view_count": 28
}
```

#### recent_views (limit: 20)

Most recent views in the period (both human and bot), joined with user and profile data.

```json
{
  "viewer_name": "Stay Njokede",
  "profession": "Lawyer",
  "profile_country": "Nigeria",
  "viewable_type": "case",
  "device_type": "desktop",
  "browser": "Chrome",
  "ip_country": "Nigeria",
  "is_bot": false,
  "viewed_at": "2026-02-16T03:45:00+00:00"
}
```

**Note:** `profession` and `profile_country` will be `null` if the viewer has no user profile.

#### top_viewers (limit: 10)

Most active human viewers by view count. **Excludes bot views.**

```json
{
  "uuid": "af8085d5-89a9-4e1e-9578-f06c26d37120",
  "name": "Stay Njokede",
  "email": "stay@example.com",
  "profession": "Lawyer",
  "view_count": 15
}
```

**Note:** `profession` will be `null` if the viewer has no user profile.

#### top_search_queries (limit: 10)

Most common internal search queries that led to content views. Only includes views where `is_from_search = true` and `search_query` is non-empty.

```json
{
  "search_query": "contract law",
  "count": 8
}
```

#### bot_activity (limit: 20)

Most recent bot views with bot classification.

```json
{
  "bot_name": "Googlebot",
  "bot_type": "search_engine",
  "viewable_type": "case",
  "viewed_at": "2026-02-16T02:30:00+00:00"
}
```

**`bot_type` values:** `search_engine`, `social_media`, `other`

#### views_by_city (limit: 15)

Geographic distribution by IP city, region, and country.

```json
{
  "city": "Lagos",
  "region": "Lagos",
  "country": "Nigeria",
  "count": 85
}
```

#### top_universities (limit: 10)

Universities with the most views and unique viewers. **Excludes bot views.**

```json
{
  "university": "University of Lagos",
  "view_count": 40,
  "unique_viewers": 12
}
```

---

## Validation & Error Responses

### 422 Validation Errors

**Invalid period value:**

```
GET /api/admin/views/analytics?period=invalid
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
GET /api/admin/views/analytics?period=date
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
GET /api/admin/views/analytics?period=date_range
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
GET /api/admin/views/analytics?period=date_range&start_date=2026-02-15&end_date=2026-02-05
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
GET /api/admin/views/analytics?period=date_range&start_date=not-a-date&end_date=also-not
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

### Views Over Time Entry (Daily)

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | Date (YYYY-MM-DD) |
| `human_views` | integer | Non-bot view count |
| `bot_views` | integer | Bot view count |
| `total_views` | integer | Total view count |

### Views Over Time Entry (Hourly)

| Field | Type | Description |
|-------|------|-------------|
| `hour` | string | Hour of day (`"00"` to `"23"`) |
| `human_views` | integer | Non-bot view count |
| `bot_views` | integer | Bot view count |
| `total_views` | integer | Total view count |

### Content Type Entry

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Content type (e.g., `"case"`, `"note"`) |
| `count` | integer | Number of views for this type |
| `percentage` | float | Percentage of total views |

### Device Breakdown Entry

| Field | Type | Description |
|-------|------|-------------|
| `device_type` | string | Device type (`"desktop"`, `"mobile"`, `"tablet"`) |
| `count` | integer | Number of views from this device |
| `percentage` | float | Percentage of human views |

### Browser Usage Entry

| Field | Type | Description |
|-------|------|-------------|
| `browser` | string | Browser name (e.g., `"Chrome"`, `"Safari"`, `"Firefox"`) |
| `count` | integer | Number of views from this browser |
| `percentage` | float | Percentage of human views |

### Human vs Bot Entry

| Field | Type | Description |
|-------|------|-------------|
| `category` | string | `"human"` or `"bot"` |
| `count` | integer | Number of views |
| `percentage` | float | Percentage of total views |

### Bot Breakdown Entry

| Field | Type | Description |
|-------|------|-------------|
| `category` | string | `"search_engine"`, `"social_media"`, or `"other"` |
| `count` | integer | Number of bot views |
| `percentage` | float | Percentage of total bot views |

### Country Entry

| Field | Type | Description |
|-------|------|-------------|
| `country` | string | Country name from IP geolocation |
| `count` | integer | Number of views from this country |

### Continent Entry

| Field | Type | Description |
|-------|------|-------------|
| `continent` | string | Continent name from IP geolocation |
| `count` | integer | Number of views from this continent |

### Profession Entry

| Field | Type | Description |
|-------|------|-------------|
| `profession` | string | Profession from user profile |
| `count` | integer | Number of views by users with this profession |
| `percentage` | float | Percentage of profiled human views |

### University Chart Entry

| Field | Type | Description |
|-------|------|-------------|
| `university` | string | University from user profile |
| `count` | integer | Number of views by users from this university |
| `percentage` | float | Percentage of profiled human views |

### Top Viewed Content Entry

| Field | Type | Description |
|-------|------|-------------|
| `viewable_type` | string | Content type (`"case"`, `"note"`) |
| `viewable_id` | integer | ID of the content item |
| `view_count` | integer | Number of human views |

### Recent View Entry

| Field | Type | Description |
|-------|------|-------------|
| `viewer_name` | string\|null | User display name |
| `profession` | string\|null | User's profession (from profile) |
| `profile_country` | string\|null | User's country (from profile) |
| `viewable_type` | string | Content type viewed |
| `device_type` | string\|null | Device type |
| `browser` | string\|null | Browser name |
| `ip_country` | string\|null | Country from IP geolocation |
| `is_bot` | boolean | Whether this was a bot view |
| `viewed_at` | datetime | ISO 8601 timestamp |

### Top Viewer Entry

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | string | User UUID |
| `name` | string | User display name |
| `email` | string | User email |
| `profession` | string\|null | User's profession (from profile) |
| `view_count` | integer | Total views in period |

### Search Query Entry

| Field | Type | Description |
|-------|------|-------------|
| `search_query` | string | The search term used |
| `count` | integer | Number of views from this search query |

### Bot Activity Entry

| Field | Type | Description |
|-------|------|-------------|
| `bot_name` | string\|null | Name of the bot |
| `bot_type` | string | `"search_engine"`, `"social_media"`, or `"other"` |
| `viewable_type` | string | Content type the bot viewed |
| `viewed_at` | datetime | ISO 8601 timestamp |

### City Entry

| Field | Type | Description |
|-------|------|-------------|
| `city` | string | City name from IP geolocation |
| `region` | string\|null | Region/state from IP geolocation |
| `country` | string\|null | Country from IP geolocation |
| `count` | integer | Number of views from this city |

### University Table Entry

| Field | Type | Description |
|-------|------|-------------|
| `university` | string | University name |
| `view_count` | integer | Total views from users at this university |
| `unique_viewers` | integer | Distinct users from this university |

---

## Implementation Files

| File | Description |
|------|-------------|
| `app/Http/Controllers/Admin/ViewController.php` | Controller with `analytics()` method |
| `app/Http/Requests/Admin/ViewAnalyticsRequest.php` | Form request validation |
| `app/Services/ViewAnalyticsService.php` | All query and aggregation logic |
| `routes/api.php` | Route registration |
| `tests/Feature/Admin/ViewAnalyticsTest.php` | 64 Pest feature tests (269 assertions) |
