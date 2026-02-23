# Admin Lawyer Connection Requests API

Endpoints for managing and analyzing lawyer connection requests from the admin panel.

**Base URL:** `/api/admin/lawyer-connection-requests`
**Authentication:** Bearer token (Sanctum)
**Authorization:** `admin` role or higher

---

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics` | Analytics dashboard with stats, charts, and tables |
| GET | `/` | List all connection requests (paginated) |
| GET | `/lawyer/{uuid}` | All connection requests for a specific lawyer |
| GET | `/{id}` | Single connection request detail |

---

## 1. GET `/analytics`

Returns aggregated analytics for lawyer connection requests.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `period` | string | No | `today`, `7d`, `30d` (default), `90d`, or `custom` |
| `start_date` | date | If `period=custom` | Start date (Y-m-d) |
| `end_date` | date | If `period=custom` | End date (Y-m-d) |

### Response

```json
{
  "success": true,
  "message": "Lawyer connection request analytics retrieved successfully.",
  "data": {
    "period": {
      "start": "2026-01-24T00:00:00+00:00",
      "end": "2026-02-23T00:22:22+00:00",
      "comparison_start": "2025-12-24T23:37:37+00:00",
      "comparison_end": "2026-01-23T23:59:59+00:00"
    },
    "stat_cards": {
      "total_requests": {
        "value": 7,
        "change_percent": 100.0
      },
      "pending_requests": {
        "value": 6,
        "change_percent": null
      },
      "lawyers_contacted": {
        "value": 4,
        "change_percent": 100.0
      }
    },
    "charts": {
      "requests_over_time": [
        { "date": "2026-02-20", "count": 2 },
        { "date": "2026-02-21", "count": 3 }
      ]
    },
    "tables": {
      "top_lawyers": [
        {
          "uuid": "db22605c-...",
          "name": "Lawyer Alpha",
          "total_requests": 3,
          "pending_requests": 2
        }
      ]
    }
  }
}
```

### Stat Cards

| Card | Description |
|------|-------------|
| `total_requests` | Total connection requests in the period, with % change vs previous period |
| `pending_requests` | Currently pending requests in the period (no comparison) |
| `lawyers_contacted` | Distinct lawyers contacted in the period, with % change |

### Charts

| Chart | Description |
|-------|-------------|
| `requests_over_time` | Daily count of connection requests over the period |

### Tables

| Table | Description |
|-------|-------------|
| `top_lawyers` | Top 10 lawyers by number of incoming requests (uuid, name, total, pending) |

---

## 2. GET `/`

List all connection requests with filtering, sorting, and pagination.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status (`pending`, `accepted`, etc.) |
| `lawyer_uuid` | string | No | Filter by lawyer's UUID |
| `sort_by` | string | No | Sort field: `created_at` (default), `updated_at`, `status` |
| `sort_order` | string | No | `desc` (default) or `asc` |
| `per_page` | int | No | Items per page, 1-100 (default: 15) |
| `page` | int | No | Page number |

### Response

```json
{
  "success": true,
  "message": "Lawyer connection requests retrieved successfully.",
  "data": [
    {
      "id": 4,
      "user": {
        "id": 93,
        "uuid": "02380b0d-...",
        "name": "Client One",
        "email": "client@example.com",
        "role": "user",
        "is_creator": false,
        "is_verified": true,
        "auth_provider": "email",
        "avatar_url": null,
        "created_at": "2026-02-23T00:22:06.000000Z"
      },
      "lawyer": {
        "id": 91,
        "uuid": "db22605c-...",
        "name": "Lawyer Alpha",
        "email": "lawyer@example.com",
        "role": "user",
        "is_creator": false,
        "is_verified": true,
        "auth_provider": "email",
        "avatar_url": null,
        "created_at": "2026-02-23T00:22:00.000000Z"
      },
      "phone_number": "+2348012345678",
      "contact_email": "client@personal.com",
      "message": "Need contract help",
      "status": "pending",
      "responded_at": null,
      "created_at": "2026-02-23T00:22:08.000000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 7,
    "last_page": 1,
    "from": 1,
    "to": 7
  },
  "links": {
    "first": "http://.../api/admin/lawyer-connection-requests?page=1",
    "last": "http://.../api/admin/lawyer-connection-requests?page=1",
    "prev": null,
    "next": null
  }
}
```

---

## 3. GET `/{id}`

Get a single connection request by its ID.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | int | The connection request ID |

### Response (200)

```json
{
  "success": true,
  "message": "Lawyer connection request retrieved successfully.",
  "data": {
    "id": 4,
    "user": { "..." },
    "lawyer": { "..." },
    "phone_number": "+2348012345678",
    "contact_email": "client@personal.com",
    "message": "Need contract help",
    "status": "pending",
    "responded_at": null,
    "created_at": "2026-02-23T00:22:08.000000Z"
  }
}
```

### Response (404)

```json
{
  "success": false,
  "message": "Lawyer connection request not found.",
  "errors": null
}
```

---

## 4. GET `/lawyer/{uuid}`

Get all connection requests sent to a specific lawyer. Use this when viewing a lawyer's profile in the admin panel.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `uuid` | string | The lawyer's user UUID |

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status (`pending`, `accepted`, etc.) |
| `sort_order` | string | No | `desc` (default) or `asc` |
| `per_page` | int | No | Items per page, 1-100 (default: 15) |
| `page` | int | No | Page number |

### Response (200)

Same structure as the list endpoint (paginated array of connection requests).

### Response (404)

```json
{
  "success": false,
  "message": "Lawyer not found.",
  "errors": null
}
```

---

## Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthenticated - missing or invalid Bearer token |
| 403 | Forbidden - user does not have `admin` role or higher |
| 404 | Resource not found (invalid ID or UUID) |
| 422 | Validation error (invalid period, missing custom dates) |

### Validation Error Example (422)

```json
{
  "success": false,
  "message": "Period must be: today, 7d, 30d, 90d, or custom.",
  "errors": {
    "period": ["Period must be: today, 7d, 30d, 90d, or custom."]
  }
}
```

---

## Implementation Files

| File | Purpose |
|------|---------|
| `app/Http/Controllers/Admin/LawyerConnectionRequestController.php` | Controller |
| `app/Http/Requests/Admin/LawyerConnectionRequestAnalyticsRequest.php` | Analytics form request validation |
| `app/Services/LawyerConnectionAnalyticsService.php` | Analytics data aggregation |
| `app/Http/Resources/LawyerConnectionRequestResource.php` | API resource transformer |
| `routes/api.php` | Route definitions |
| `tests/Feature/Admin/LawyerConnectionRequestControllerTest.php` | Feature tests (24 tests) |
