# Phase 11: Trending System - API Documentation

## Overview

Phase 11 implements a trending content system that surfaces popular cases and notes based on weighted view engagement. Trending filters are based on **viewer properties** (university, level, country) — not content properties — answering "what's popular among users like me." Smart defaults personalize results based on user type, and all endpoints work both authenticated and unauthenticated.

---

## Table of Contents

1. [Trending Endpoints](#trending-endpoints)
2. [Smart Filter Defaults](#smart-filter-defaults)
3. [Filter Overrides](#filter-overrides)
4. [Time Ranges](#time-ranges)
5. [Data Models](#data-models)
6. [Error Responses](#error-responses)
7. [Frontend Integration Guide](#frontend-integration-guide)

---

## Trending Endpoints

### Authentication

All trending endpoints are **public** — no `auth:sanctum` middleware required. However, authenticated users receive personalized default filters based on their profile.

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/trending` | GET | No | Public |
| `/api/trending/cases` | GET | No | Public |
| `/api/trending/notes` | GET | No | Public |

---

### GET /api/trending

Get mixed trending content (cases and notes merged), sorted by trending score.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `university` | string | No | Auto | Filter by viewer's university. Pass empty string to disable. |
| `level` | string | No | Auto | Filter by viewer's academic level (e.g., `100`, `200`, `100L`). Pass empty string to disable. |
| `country` | string | No | Auto | Filter by viewer's country. Pass empty string to disable. |
| `time_range` | string | No | `month` | One of: `today`, `week`, `month`, `year`, `custom` |
| `start_date` | date | If custom | - | Start date for custom range (Y-m-d). Required when `time_range=custom`. |
| `end_date` | date | If custom | - | End date for custom range (Y-m-d). Required when `time_range=custom`. |
| `per_page` | integer | No | 15 | Items per page (1-100) |
| `page` | integer | No | 1 | Page number |

**Response (Success - 200):**
```json
{
    "success": true,
    "message": "Trending content retrieved successfully.",
    "data": [
        {
            "id": 8474,
            "type": "case",
            "title": "Politis v Plastico Ltd (No. 2), (1967) AFRICAN LR (COMM) 178",
            "slug": "politis-v-plastico-ltd-no-2-1967-african-lr-comm-178",
            "judgment_date": "1967-01-30",
            "citation": "(1967) LAWEXA ELR 8906 GH HC",
            "level": "500L",
            "trending_score": 15,
            "views_count": 3,
            "unique_viewers": 2,
            "last_viewed_at": "2026-01-26T20:47:00+00:00"
        },
        {
            "id": 87,
            "type": "note",
            "title": "CONSIDERATION IN THE LAW OF CONTRACT",
            "slug": "consideration-in-the-law-of-contract",
            "content_preview": "Consideration in Contract Law is one of the five essential elements necessary to form a valid contract...",
            "tags": ["Law of Contracts", "Consideration"],
            "price_ngn": null,
            "price_usd": null,
            "is_free": true,
            "thumbnail_url": null,
            "trending_score": 8.5,
            "views_count": 4,
            "unique_viewers": 1,
            "last_viewed_at": "2026-01-24T18:04:09+00:00"
        }
    ],
    "pagination": {
        "current_page": 1,
        "per_page": 15,
        "total": 21,
        "last_page": 2,
        "from": 1,
        "to": 15
    },
    "links": {
        "first": "https://demo-api.lawexa.com/api/trending?page=1",
        "last": "https://demo-api.lawexa.com/api/trending?page=2",
        "prev": null,
        "next": "https://demo-api.lawexa.com/api/trending?page=2"
    },
    "meta": {
        "filters_applied": {
            "university": null,
            "level": null,
            "country": "Ghana",
            "time_range": "month"
        }
    }
}
```

**Empty Response (200):**
```json
{
    "success": true,
    "message": "Trending content retrieved successfully.",
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
        "first": "https://demo-api.lawexa.com/api/trending?page=1",
        "last": "https://demo-api.lawexa.com/api/trending?page=1",
        "prev": null,
        "next": null
    },
    "meta": {
        "filters_applied": {
            "university": "Ashesi University",
            "level": "Level 200",
            "country": null,
            "time_range": "month"
        }
    }
}
```

**Notes:**
- Mixed content returns both cases and notes merged and sorted by `trending_score` descending
- Each item includes a `type` field (`"case"` or `"note"`) to distinguish content types
- `meta.filters_applied` shows the resolved filters (after smart defaults are applied)
- Content must have at least 2 views (configurable via `trending_min_views` setting) to appear
- Bot views are excluded from all trending calculations

---

### GET /api/trending/cases

Get trending cases only, sorted by trending score.

**Query Parameters:** Same as `GET /api/trending`.

**Response (Success - 200):**
```json
{
    "success": true,
    "message": "Trending cases retrieved successfully.",
    "data": [
        {
            "id": 8474,
            "type": "case",
            "title": "Politis v Plastico Ltd (No. 2), (1967) AFRICAN LR (COMM) 178",
            "slug": "politis-v-plastico-ltd-no-2-1967-african-lr-comm-178",
            "court": "High Court",
            "country": {
                "name": "Ghana",
                "code": "GH"
            },
            "judgment_date": "1967-01-30",
            "citation": "(1967) LAWEXA ELR 8906 GH HC",
            "level": "500L",
            "trending_score": 15,
            "views_count": 3,
            "unique_viewers": 2,
            "last_viewed_at": "2026-01-26T20:47:00+00:00"
        }
    ],
    "pagination": {
        "current_page": 1,
        "per_page": 15,
        "total": 4,
        "last_page": 1,
        "from": 1,
        "to": 4
    },
    "links": {
        "first": "https://demo-api.lawexa.com/api/trending/cases?page=1",
        "last": "https://demo-api.lawexa.com/api/trending/cases?page=1",
        "prev": null,
        "next": null
    },
    "meta": {
        "filters_applied": {
            "university": "Ashesi University",
            "level": "Level 200",
            "country": null,
            "time_range": "month"
        }
    }
}
```

**Notes:**
- Includes `court` and `country` relationships (eager loaded)
- `court` is a string (court name) when loaded, `null` otherwise
- `country` is an object with `name` and `code` when loaded, `null` otherwise

---

### GET /api/trending/notes

Get trending notes only, sorted by trending score.

**Query Parameters:** Same as `GET /api/trending`.

**Response (Success - 200):**
```json
{
    "success": true,
    "message": "Trending notes retrieved successfully.",
    "data": [
        {
            "id": 87,
            "type": "note",
            "title": "CONSIDERATION IN THE LAW OF CONTRACT",
            "slug": "consideration-in-the-law-of-contract",
            "content_preview": "Consideration in Contract Law is one of the five essential elements necessary to form a valid contract...",
            "author": {
                "id": 2,
                "name": "Lawexa"
            },
            "tags": ["Law of Contracts", "Consideration", "Adequacy"],
            "price_ngn": null,
            "price_usd": null,
            "is_free": true,
            "thumbnail_url": null,
            "trending_score": 8.5,
            "views_count": 4,
            "unique_viewers": 1,
            "last_viewed_at": "2026-01-24T18:04:09+00:00"
        }
    ],
    "pagination": {
        "current_page": 1,
        "per_page": 15,
        "total": 11,
        "last_page": 1,
        "from": 1,
        "to": 11
    },
    "links": {
        "first": "https://demo-api.lawexa.com/api/trending/notes?page=1",
        "last": "https://demo-api.lawexa.com/api/trending/notes?page=1",
        "prev": null,
        "next": null
    },
    "meta": {
        "filters_applied": {
            "university": null,
            "level": null,
            "country": "Ghana",
            "time_range": "month"
        }
    }
}
```

**Notes:**
- Includes `author` relationship (eager loaded)
- `author` is an object with `id` and `name` when loaded
- `content_preview` is a 150-character truncated, tag-stripped preview

---

## Smart Filter Defaults

Trending endpoints apply smart default filters based on the authenticated user's profile. These defaults determine what "relevant trending" means for each user type.

### Default Behavior by User Type

| User Type | Detection | Default Filters Applied |
|-----------|-----------|------------------------|
| **Student** | `profile.profession` contains `"student"` (case-insensitive) | `university` + `level` from profile |
| **Non-student** | Any other profession | `country` from IP geolocation |
| **Guest** | Not authenticated | `country` from IP geolocation |

### Examples

**Authenticated student** (university: "Ashesi University", level: "Level 200", profession: "student"):
```
GET /api/trending
→ filters_applied: { university: "Ashesi University", level: "Level 200", country: null, time_range: "month" }
```

**Authenticated non-student** (profession: "lawyer", country detected via IP: "Ghana"):
```
GET /api/trending
→ filters_applied: { university: null, level: null, country: "Ghana", time_range: "month" }
```

**Guest** (IP geolocation detects "Ghana"):
```
GET /api/trending
→ filters_applied: { university: null, level: null, country: "Ghana", time_range: "month" }
```

**Notes:**
- IP country is resolved via `GeoService::parseIp()` at request time
- Student detection uses `str_contains(strtolower(profession), 'student')` to match variants like "Law Student", "Student", etc.
- Profile is queried fresh from database (not cached) to avoid stale relation data

---

## Filter Overrides

Explicit query parameters always override smart defaults. Pass an empty string to disable a default filter entirely.

### Override Examples

**Override university** (student at Ashesi, wants to see KNUST trending):
```
GET /api/trending?university=KNUST
→ filters_applied: { university: "KNUST", level: "Level 200", country: null, time_range: "month" }
```

**Disable university + level filters** (student wants global trending):
```
GET /api/trending?university=&level=
→ filters_applied: { university: null, level: null, country: null, time_range: "month" }
```

**Disable country filter** (guest wants global trending):
```
GET /api/trending?country=
→ filters_applied: { university: null, level: null, country: null, time_range: "month" }
```

**Override country** (guest wants to see Nigeria trending):
```
GET /api/trending?country=Nigeria
→ filters_applied: { university: null, level: null, country: "Nigeria", time_range: "month" }
```

**Notes:**
- Empty string (`?university=`) disables the filter
- Omitting the parameter uses the smart default
- Multiple overrides can be combined

---

## Time Ranges

### Predefined Ranges

| Value | Period |
|-------|--------|
| `today` | Current day (00:00 to now) |
| `week` | Last 7 days |
| `month` | Last 30 days (default) |
| `year` | Last 365 days |
| `custom` | User-specified `start_date` to `end_date` |

### Custom Range

When `time_range=custom`, both `start_date` and `end_date` are required in `Y-m-d` format.

```
GET /api/trending?time_range=custom&start_date=2026-01-01&end_date=2026-01-15
```

**Validation (Error - 422):**
```json
{
    "success": false,
    "message": "Start date is required when time range is custom. (and 1 more error)",
    "errors": {
        "start_date": [
            "Start date is required when time range is custom."
        ],
        "end_date": [
            "End date is required when time range is custom."
        ]
    }
}
```

**Validation Rules:**
- `start_date` must be before or equal to `end_date`
- `end_date` must be after or equal to `start_date`
- Both are required when `time_range=custom`

---

## Data Models

### TrendingCaseResource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Case ID |
| `type` | string | Always `"case"` |
| `title` | string | Case title |
| `slug` | string | URL-friendly identifier |
| `court` | string\|null | Court name (loaded on `/cases` endpoint) |
| `country` | object\|null | Country `{ name, code }` (loaded on `/cases` endpoint) |
| `judgment_date` | string\|null | Judgment date (Y-m-d) |
| `citation` | string\|null | Legal citation |
| `level` | string\|null | Academic level |
| `trending_score` | float | Calculated trending score |
| `views_count` | integer | Total views in period |
| `unique_viewers` | integer | Distinct viewers in period |
| `last_viewed_at` | datetime\|null | ISO 8601 timestamp of most recent view |

### TrendingNoteResource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Note ID |
| `type` | string | Always `"note"` |
| `title` | string | Note title |
| `slug` | string | URL-friendly identifier |
| `content_preview` | string | Tag-stripped, 150-character truncated preview |
| `author` | object\|null | Author `{ id, name }` (loaded on `/notes` endpoint) |
| `tags` | array\|null | Note tags |
| `price_ngn` | string\|null | Price in NGN |
| `price_usd` | string\|null | Price in USD |
| `is_free` | boolean | Free status |
| `thumbnail_url` | string\|null | Thumbnail URL |
| `trending_score` | float | Calculated trending score |
| `views_count` | integer | Total views in period |
| `unique_viewers` | integer | Distinct viewers in period |
| `last_viewed_at` | datetime\|null | ISO 8601 timestamp of most recent view |

### TrendingMixedResource

Delegates to `TrendingCaseResource` or `TrendingNoteResource` based on the underlying model type. Use the `type` field to distinguish between `"case"` and `"note"` items.

**Notes:**
- On the mixed `/api/trending` endpoint, `court` and `country` are not loaded for cases, and `author` is not loaded for notes (to reduce query overhead)
- On the type-specific endpoints (`/cases`, `/notes`), the respective relationships are loaded

---

## Trending Score Algorithm

### Formula

```
trending_score = weighted_views + unique_viewer_boost + recency_boost
```

### Weighted Views

Views are weighted by recency:

| Time Bucket | Default Weight | Setting Key |
|-------------|---------------|-------------|
| Last 24 hours | 3 | `trending_24h_weight` |
| 24 hours to 3 days | 2 | `trending_3d_weight` |
| Older than 3 days | 1 | `trending_older_weight` |

### Unique Viewer Boost

```
unique_viewer_boost = min(unique_viewers × 0.5, 10)
```

| Setting | Default | Description |
|---------|---------|-------------|
| `trending_unique_viewer_boost` | 0.5 | Points per unique viewer |
| `trending_max_unique_boost` | 10 | Maximum boost cap |

### Recency Boost

Based on `last_viewed_at`:

| Time Since Last View | Boost Points |
|---------------------|-------------|
| ≤ 1 hour | 5 |
| ≤ 6 hours | 3 |
| ≤ 24 hours | 1 |
| > 24 hours | 0 |

Maximum recency boost is configurable via `trending_max_recency_boost` setting (default: 5).

---

## Error Responses

### 422 Unprocessable Entity

Returned for validation errors.

**Invalid time_range:**
```json
{
    "success": false,
    "message": "Time range must be one of: today, week, month, year, custom.",
    "errors": {
        "time_range": [
            "Time range must be one of: today, week, month, year, custom."
        ]
    }
}
```

**Custom range missing dates:**
```json
{
    "success": false,
    "message": "Start date is required when time range is custom. (and 1 more error)",
    "errors": {
        "start_date": [
            "Start date is required when time range is custom."
        ],
        "end_date": [
            "End date is required when time range is custom."
        ]
    }
}
```

**Invalid date order:**
```json
{
    "success": false,
    "message": "Start date must be before or equal to end date.",
    "errors": {
        "start_date": [
            "Start date must be before or equal to end date."
        ]
    }
}
```

---

## Caching

Trending results are cached for performance with a configurable TTL.

| Setting | Default | Description |
|---------|---------|-------------|
| `trending_cache_ttl_minutes` | 5 | Cache duration in minutes |

### Cache Key Structure

```
trending:{type}:{md5(filters)}:page:{page}
```

- `type`: `mixed`, `cases`, or `notes`
- `filters`: MD5 hash of resolved filter values (university, level, country, time_range, start_date, end_date)
- `page`: Page number

**Behavior:**
- Users with the same resolved filters share cached results
- Each page is cached separately
- No explicit cache invalidation — natural TTL expiry handles freshness
- Different filter combinations produce different cache keys

---

## Pagination

### Default Values

| Parameter | Default | Maximum |
|-----------|---------|---------|
| `per_page` | 15 | 100 |
| `page` | 1 | - |

### Pagination Response

```json
{
    "pagination": {
        "current_page": 1,
        "per_page": 15,
        "total": 21,
        "last_page": 2,
        "from": 1,
        "to": 15
    },
    "links": {
        "first": "https://demo-api.lawexa.com/api/trending?page=1",
        "last": "https://demo-api.lawexa.com/api/trending?page=2",
        "prev": null,
        "next": "https://demo-api.lawexa.com/api/trending?page=2"
    }
}
```

---

## Settings

### Trending Settings

| Key | Default | Type | Description |
|-----|---------|------|-------------|
| `trending_24h_weight` | 3 | Integer | Weight for views in last 24 hours |
| `trending_3d_weight` | 2 | Integer | Weight for views between 24h and 3 days |
| `trending_older_weight` | 1 | Integer | Weight for views older than 3 days |
| `trending_cache_ttl_minutes` | 5 | Integer | Cache duration for trending queries |
| `trending_min_views` | 2 | Integer | Minimum views to appear in trending |
| `trending_unique_viewer_boost` | 0.5 | String | Points per unique viewer |
| `trending_max_unique_boost` | 10 | Integer | Maximum unique viewer boost cap |
| `trending_max_recency_boost` | 5 | Integer | Maximum recency boost points |

---

## Frontend Integration Guide

### React/Next.js Example

```typescript
// Fetch trending content (smart defaults applied automatically)
async function fetchTrending(token?: string) {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  // Include auth token for personalized defaults (optional)
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/trending', { headers });
  const data = await response.json();

  return data;
}

// Fetch trending with explicit filters
async function fetchTrendingFiltered(params: {
  university?: string;
  level?: string;
  country?: string;
  time_range?: string;
  per_page?: number;
  page?: number;
}, token?: string) {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  });

  const response = await fetch(`/api/trending?${searchParams}`, { headers });
  return response.json();
}

// Fetch global trending (disable all smart defaults)
async function fetchGlobalTrending(token?: string) {
  return fetchTrendingFiltered({
    university: '',
    level: '',
    country: '',
  }, token);
}

// Fetch trending cases only
async function fetchTrendingCases(token?: string) {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/trending/cases', { headers });
  return response.json();
}

// Fetch trending notes only
async function fetchTrendingNotes(token?: string) {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/trending/notes', { headers });
  return response.json();
}
```

### Rendering Mixed Content

```tsx
function TrendingList({ items }: { items: TrendingItem[] }) {
  return (
    <div>
      {items.map((item) => (
        item.type === 'case'
          ? <TrendingCaseCard key={`case-${item.id}`} case={item} />
          : <TrendingNoteCard key={`note-${item.id}`} note={item} />
      ))}
    </div>
  );
}
```

### Filter UI Considerations

1. **Show applied filters** from `meta.filters_applied` so users understand why they see specific results
2. **Provide a "Global Trending" toggle** that passes `?university=&level=&country=` to disable all defaults
3. **Allow university/level override** for students who want to see trending at other institutions
4. **Show time range selector** with options: Today, This Week, This Month, This Year

---

## Notes

### Viewer-Based Filtering

All filters (university, level, country) operate on **viewer properties**, not content properties. This means:
- "Trending at KNUST" = content most viewed by users whose profile university is "KNUST"
- "Trending in Ghana" = content most viewed by users whose profile country is "Ghana"
- The content itself may be from any jurisdiction or level

### Level Normalization

The API normalizes level input by stripping trailing `L`/`l` suffix:
- `100L` → matches profiles with `100`, `100L`, `100l`
- `200` → matches profiles with `200`, `200L`, `200l`

### Bot Exclusion

All bot views (identified via `views.is_bot = true`) are excluded from trending calculations. This prevents SEO crawlers and automated tools from inflating trending scores.

### Minimum View Threshold

Content must have at least `trending_min_views` (default: 2) views within the selected time range to appear in trending results. This prevents content with a single accidental view from appearing.
