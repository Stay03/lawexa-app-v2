# Case Form - Complete API Reference

## Overview

This document covers all API endpoints needed by the frontend to implement the Admin Add/Edit Case form, including lookup table management (countries, courts, courses, judges), case CRUD operations, autocomplete for topics and tags, and case file management. All responses follow a consistent envelope format with `success`, `message`, `data`, `errors`, `pagination`, and `links` fields.

---

## Table of Contents

1. [Countries](#countries)
2. [Courts](#courts)
3. [Courses](#courses)
4. [Judges](#judges)
5. [Cases](#cases)
6. [Autocomplete](#autocomplete)
7. [Case Files](#case-files)
8. [File Management](#file-management)
9. [Error Responses](#error-responses)
10. [Data Models](#data-models)

---

## Countries

### Authentication

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/countries` | GET | Yes | Any |
| `/api/countries` | POST | Yes | Researcher+ |
| `/api/countries/{country}` | PUT | Yes | Researcher+ |
| `/api/countries/{country}` | DELETE | Yes | Admin |

---

### GET /api/countries

List paginated countries.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | — | Filter by name or code (case-insensitive) |
| `sort` | string | `name` | Sort field: `name`, `code`, `created_at` |
| `order` | string | `asc` | Sort direction: `asc`, `desc` |
| `per_page` | integer | `15` | Items per page (1–100) |
| `page` | integer | `1` | Page number |

**Response:**
```json
{
  "success": true,
  "message": "Countries retrieved successfully.",
  "data": [
    {
      "id": 1,
      "name": "Nigeria",
      "code": "NG",
      "abbreviation": "NG",
      "slug": "nigeria",
      "created_at": "2026-01-19T15:02:11.000000Z",
      "updated_at": "2026-01-19T15:02:11.000000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 27,
    "last_page": 2,
    "from": 1,
    "to": 15
  },
  "links": {
    "first": "http://127.0.0.1:8000/api/countries?page=1",
    "last": "http://127.0.0.1:8000/api/countries?page=2",
    "prev": null,
    "next": "http://127.0.0.1:8000/api/countries?page=2"
  }
}
```

**Search Example (`?search=nig`):**
```json
{
  "success": true,
  "message": "Countries retrieved successfully.",
  "data": [
    {
      "id": 1,
      "name": "Nigeria",
      "code": "NG",
      "abbreviation": "NG",
      "slug": "nigeria",
      "created_at": "2026-01-19T15:02:11.000000Z",
      "updated_at": "2026-01-19T15:02:11.000000Z"
    },
    {
      "id": 26,
      "name": "Niger",
      "code": "NE",
      "abbreviation": "NE",
      "slug": "niger",
      "created_at": "2026-01-19T15:02:11.000000Z",
      "updated_at": "2026-01-19T15:02:11.000000Z"
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
    "first": "http://127.0.0.1:8000/api/countries?page=1",
    "last": "http://127.0.0.1:8000/api/countries?page=1",
    "prev": null,
    "next": null
  }
}
```

---

### POST /api/countries

Create a new country. Slug is auto-generated from the name if not provided.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | max:255 |
| `code` | string | Yes | max:3, unique |
| `abbreviation` | string | No | max:10 |
| `slug` | string | No | max:255, lowercase-hyphenated |

**Request Example:**
```json
{
  "name": "Test Country",
  "code": "TC",
  "abbreviation": "TC"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Country created successfully.",
  "data": {
    "id": 38,
    "name": "Test Country",
    "code": "TC",
    "abbreviation": "TC",
    "slug": "test-country",
    "created_at": "2026-02-10T14:30:00.000000Z",
    "updated_at": "2026-02-10T14:30:00.000000Z"
  }
}
```

**Validation Error (422) - Missing Fields:**
```json
{
  "success": false,
  "message": "Please provide a country name. (and 1 more error)",
  "errors": {
    "name": ["Please provide a country name."],
    "code": ["Please provide a country code."]
  }
}
```

**Validation Error (422) - Duplicate Code:**
```json
{
  "success": false,
  "message": "A country with this code already exists.",
  "errors": {
    "code": ["A country with this code already exists."]
  }
}
```

---

### PUT /api/countries/{country}

Update a country. Only send the fields you want to change.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | No | max:255 |
| `code` | string | No | max:3, unique (ignoring self) |
| `abbreviation` | string | No | max:10 |
| `slug` | string | No | max:255, lowercase-hyphenated |

**Request Example:**
```json
{
  "name": "Updated Country Name"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Country updated successfully.",
  "data": {
    "id": 38,
    "name": "Updated Country Name",
    "code": "TC",
    "abbreviation": "TC",
    "slug": "test-country",
    "created_at": "2026-02-10T14:30:00.000000Z",
    "updated_at": "2026-02-10T14:35:00.000000Z"
  }
}
```

---

### DELETE /api/countries/{country}

Delete a country. Fails if cases reference this country.

**Response (200):**
```json
{
  "success": true,
  "message": "Country deleted successfully.",
  "data": null
}
```

**Conflict (409) - Country Has Cases:**
```json
{
  "success": false,
  "message": "Cannot delete this country because it has associated cases.",
  "errors": null
}
```

---

## Courts

### Authentication

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/courts` | GET | Yes | Any |
| `/api/courts` | POST | Yes | Researcher+ |
| `/api/courts/{court}` | PUT | Yes | Researcher+ |
| `/api/courts/{court}` | DELETE | Yes | Admin |

---

### GET /api/courts

List paginated courts. Includes the related country.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | — | Filter by name or abbreviation (case-insensitive) |
| `country` | string/int | — | Filter by country ID or country code (e.g. `NG`) |
| `sort` | string | `name` | Sort field: `name`, `abbreviation`, `created_at` |
| `order` | string | `asc` | Sort direction: `asc`, `desc` |
| `per_page` | integer | `15` | Items per page (1–100) |
| `page` | integer | `1` | Page number |

**Response:**
```json
{
  "success": true,
  "message": "Courts retrieved successfully.",
  "data": [
    {
      "id": 1,
      "name": "Supreme Court of Nigeria",
      "slug": "supreme-court-of-nigeria",
      "abbreviation": "SC",
      "country": {
        "id": 1,
        "name": "Nigeria",
        "code": "NG",
        "abbreviation": "NG",
        "slug": "nigeria",
        "created_at": "2026-01-19T15:02:11.000000Z",
        "updated_at": "2026-01-19T15:02:11.000000Z"
      },
      "created_at": "2026-01-19T15:02:11.000000Z",
      "updated_at": "2026-01-19T15:02:11.000000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 26,
    "last_page": 2,
    "from": 1,
    "to": 15
  },
  "links": {
    "first": "http://127.0.0.1:8000/api/courts?page=1",
    "last": "http://127.0.0.1:8000/api/courts?page=2",
    "prev": null,
    "next": "http://127.0.0.1:8000/api/courts?page=2"
  }
}
```

---

### POST /api/courts

Create a new court. Slug is auto-generated from the name. If `abbreviation` is not provided, it is auto-generated from the name initials (e.g. "Supreme Court" becomes "SC").

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | max:255, unique |
| `abbreviation` | string | No | max:20 (auto-generated if omitted) |
| `country_id` | integer | No | must exist in countries |
| `slug` | string | No | max:255, lowercase-hyphenated |

**Request Example:**
```json
{
  "name": "Federal High Court",
  "country_id": 1
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Court created successfully.",
  "data": {
    "id": 49,
    "name": "Federal High Court",
    "slug": "federal-high-court",
    "abbreviation": "FHC",
    "country": {
      "id": 1,
      "name": "Nigeria",
      "code": "NG",
      "abbreviation": "NG",
      "slug": "nigeria",
      "created_at": "2026-01-19T15:02:11.000000Z",
      "updated_at": "2026-01-19T15:02:11.000000Z"
    },
    "created_at": "2026-02-10T14:30:00.000000Z",
    "updated_at": "2026-02-10T14:30:00.000000Z"
  }
}
```

**Validation Error (422) - Duplicate Name:**
```json
{
  "success": false,
  "message": "The name has already been taken.",
  "errors": {
    "name": ["The name has already been taken."]
  }
}
```

---

### PUT /api/courts/{court}

Update a court. Only send the fields you want to change.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | No | max:255, unique (ignoring self) |
| `abbreviation` | string | No | max:20 |
| `country_id` | integer | No | must exist in countries |
| `slug` | string | No | max:255, lowercase-hyphenated |

**Response (200):**
```json
{
  "success": true,
  "message": "Court updated successfully.",
  "data": {
    "id": 49,
    "name": "Updated Court Name",
    "slug": "federal-high-court",
    "abbreviation": "FHC",
    "country": {
      "id": 1,
      "name": "Nigeria",
      "code": "NG",
      "abbreviation": "NG",
      "slug": "nigeria",
      "created_at": "2026-01-19T15:02:11.000000Z",
      "updated_at": "2026-01-19T15:02:11.000000Z"
    },
    "created_at": "2026-02-10T14:30:00.000000Z",
    "updated_at": "2026-02-10T14:35:00.000000Z"
  }
}
```

---

### DELETE /api/courts/{court}

Delete a court. Fails if cases reference this court.

**Response (200):**
```json
{
  "success": true,
  "message": "Court deleted successfully.",
  "data": null
}
```

**Conflict (409) - Court Has Cases:**
```json
{
  "success": false,
  "message": "Cannot delete this court because it has associated cases.",
  "errors": null
}
```

---

## Courses

### Authentication

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/courses` | GET | Yes | Any |
| `/api/courses/{course:slug}` | GET | Yes | Any |
| `/api/courses` | POST | Yes | Researcher+ |
| `/api/courses/{course}` | PUT | Yes | Researcher+ |
| `/api/courses/{course}` | DELETE | Yes | Admin |
| `/api/courses/{id}/restore` | POST | Yes | Admin |

---

### GET /api/courses

List paginated courses.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | — | Filter by name (case-insensitive) |
| `sort` | string | `name` | Sort field: `name`, `created_at` |
| `order` | string | `asc` | Sort direction: `asc`, `desc` |
| `per_page` | integer | `15` | Items per page (1–100) |
| `page` | integer | `1` | Page number |
| `with_trashed` | boolean | — | Include soft-deleted (admin only) |

**Response:**
```json
{
  "success": true,
  "message": "Courses retrieved successfully.",
  "data": [
    {
      "id": 1,
      "name": "Administrative Law",
      "slug": "administrative-law",
      "created_at": "2026-01-19T15:02:11.000000Z",
      "updated_at": "2026-01-19T15:02:11.000000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 30,
    "last_page": 2,
    "from": 1,
    "to": 15
  },
  "links": {
    "first": "http://127.0.0.1:8000/api/courses?page=1",
    "last": "http://127.0.0.1:8000/api/courses?page=2",
    "prev": null,
    "next": "http://127.0.0.1:8000/api/courses?page=2"
  }
}
```

---

### GET /api/courses/{course:slug}

Get a single course by slug.

**Response (200):**
```json
{
  "success": true,
  "message": "Course retrieved successfully.",
  "data": {
    "id": 1,
    "name": "Administrative Law",
    "slug": "administrative-law",
    "cases_count": 42,
    "created_at": "2026-01-19T15:02:11.000000Z",
    "updated_at": "2026-01-19T15:02:11.000000Z"
  }
}
```

---

### POST /api/courses

Create a new course. Slug is auto-generated from the name if not provided.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | max:255, unique |
| `slug` | string | No | max:255, lowercase-hyphenated |

**Request Example:**
```json
{
  "name": "Environmental Law"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Course created successfully.",
  "data": {
    "id": 43,
    "name": "Environmental Law",
    "slug": "environmental-law",
    "created_at": "2026-02-10T14:30:00.000000Z",
    "updated_at": "2026-02-10T14:30:00.000000Z"
  }
}
```

**Validation Error (422) - Duplicate Name:**
```json
{
  "success": false,
  "message": "A course with this name already exists.",
  "errors": {
    "name": ["A course with this name already exists."]
  }
}
```

---

### PUT /api/courses/{course}

Update a course. Only send the fields you want to change.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | No | max:255, unique (ignoring self) |
| `slug` | string | No | max:255, lowercase-hyphenated |

**Response (200):**
```json
{
  "success": true,
  "message": "Course updated successfully.",
  "data": {
    "id": 43,
    "name": "Updated Course Name",
    "slug": "environmental-law",
    "created_at": "2026-02-10T14:30:00.000000Z",
    "updated_at": "2026-02-10T14:35:00.000000Z"
  }
}
```

---

### DELETE /api/courses/{course}

Soft-delete a course. Admin only.

**Response (200):**
```json
{
  "success": true,
  "message": "Course deleted successfully.",
  "data": null
}
```

### POST /api/courses/{id}/restore

Restore a soft-deleted course. Admin only.

**Response (200):**
```json
{
  "success": true,
  "message": "Course restored successfully.",
  "data": {
    "id": 43,
    "name": "Environmental Law",
    "slug": "environmental-law",
    "created_at": "2026-02-10T14:30:00.000000Z",
    "updated_at": "2026-02-10T14:40:00.000000Z"
  }
}
```

---

## Judges

### Authentication

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/judges` | GET | Yes | Any |
| `/api/judges` | POST | Yes | Researcher+ |
| `/api/judges/{judge}` | PUT | Yes | Researcher+ |
| `/api/judges/{judge}` | DELETE | Yes | Admin |

---

### GET /api/judges

List paginated judges.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | — | Filter by name (case-insensitive) |
| `sort` | string | `name` | Sort field: `name`, `created_at` |
| `order` | string | `asc` | Sort direction: `asc`, `desc` |
| `per_page` | integer | `15` | Items per page (1–100) |
| `page` | integer | `1` | Page number |

**Response:**
```json
{
  "success": true,
  "message": "Judges retrieved successfully.",
  "data": [
    {
      "id": 1,
      "name": "Justice Ayo Salami",
      "slug": "justice-ayo-salami",
      "created_at": "2026-01-19T15:02:11.000000Z",
      "updated_at": "2026-01-19T15:02:11.000000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 1100,
    "last_page": 74,
    "from": 1,
    "to": 15
  },
  "links": {
    "first": "http://127.0.0.1:8000/api/judges?page=1",
    "last": "http://127.0.0.1:8000/api/judges?page=74",
    "prev": null,
    "next": "http://127.0.0.1:8000/api/judges?page=2"
  }
}
```

---

### POST /api/judges

Create a new judge. Slug is auto-generated from the name if not provided.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | max:255, unique |
| `slug` | string | No | max:255, lowercase-hyphenated |

**Request Example:**
```json
{
  "name": "Justice Test Name"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Judge created successfully.",
  "data": {
    "id": 1113,
    "name": "Justice Test Name",
    "slug": "justice-test-name",
    "created_at": "2026-02-10T14:30:00.000000Z",
    "updated_at": "2026-02-10T14:30:00.000000Z"
  }
}
```

---

### PUT /api/judges/{judge}

Update a judge. Only send the fields you want to change.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | No | max:255, unique (ignoring self) |
| `slug` | string | No | max:255, lowercase-hyphenated |

**Response (200):**
```json
{
  "success": true,
  "message": "Judge updated successfully.",
  "data": {
    "id": 1113,
    "name": "Updated Judge Name",
    "slug": "justice-test-name",
    "created_at": "2026-02-10T14:30:00.000000Z",
    "updated_at": "2026-02-10T14:35:00.000000Z"
  }
}
```

---

### DELETE /api/judges/{judge}

Delete a judge. Admin only.

**Response (200):**
```json
{
  "success": true,
  "message": "Judge deleted successfully.",
  "data": null
}
```

---

## Cases

### Authentication

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/cases` | GET | Yes | Any |
| `/api/cases/{case:slug}` | GET | Yes | Any |
| `/api/cases` | POST | Yes | Researcher+ |
| `/api/cases/{case}` | PUT | Yes | Researcher+ |
| `/api/cases/{case}` | DELETE | Yes | Researcher+ |
| `/api/cases/{id}/restore` | POST | Yes | Admin |

---

### GET /api/cases

List paginated cases. Returns a summary resource per case (not the full case body).

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | — | Full-text search on title, body, topic, tags, principles |
| `course` | string/int | — | Filter by course ID or slug |
| `country` | string/int | — | Filter by country ID or code |
| `court` | string/int | — | Filter by court ID or abbreviation |
| `judge` | string/int | — | Filter by judge ID or slug |
| `topic` | string | — | Filter by topic |
| `level` | string | — | Filter by level |
| `tags` | string/array | — | Filter by tags |
| `date_from` | date | — | Judgment date from (YYYY-MM-DD) |
| `date_to` | date | — | Judgment date to (YYYY-MM-DD) |
| `sort` | string | — | Sort field |
| `order` | string | `desc` | Sort direction: `asc`, `desc` |
| `per_page` | integer | `15` | Items per page (1–100) |
| `page` | integer | `1` | Page number |
| `with_trashed` | boolean | — | Include soft-deleted (admin only) |

**Response:**
```json
{
  "success": true,
  "message": "Cases retrieved successfully.",
  "data": [
    {
      "id": 8841,
      "title": "Macaulay v. RZB of Austria",
      "slug": "macaulay-v-rzb-of-austria",
      "court": "SC",
      "judgment_date": "2003-07-03",
      "citation": "(2003) LAWEXA ELR 2541 NG SC",
      "is_bookmarked": false,
      "bookmarks_count": 0,
      "views_count": 12
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 8841,
    "last_page": 590,
    "from": 1,
    "to": 15
  },
  "links": {
    "first": "http://127.0.0.1:8000/api/cases?page=1",
    "last": "http://127.0.0.1:8000/api/cases?page=590",
    "prev": null,
    "next": "http://127.0.0.1:8000/api/cases?page=2"
  }
}
```

**Notes:**
- The list endpoint returns `CaseSummaryResource` — a lightweight shape with `court` as a string (abbreviation), not a full object.
- Use the show endpoint (`GET /api/cases/{slug}`) for the full case detail.

---

### GET /api/cases/{case:slug}

Get a single case by slug. Includes full body, related entities, and optional relationship includes.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `include_full_report` | boolean | `false` | Include the full report text |
| `include_similar_cases` | boolean | `false` | Include similar cases list |
| `include_cited_cases` | boolean | `false` | Include cited cases list |
| `include_cited_by` | boolean | `false` | Include cases that cite this case |

**Response (200):**
```json
{
  "success": true,
  "message": "Case retrieved successfully.",
  "data": {
    "id": 8841,
    "title": "Macaulay v. RZB of Austria",
    "slug": "macaulay-v-rzb-of-austria",
    "course": {
      "id": 1,
      "name": "Company Law",
      "slug": "company-law",
      "created_at": "2026-01-19T15:02:11.000000Z",
      "updated_at": "2026-01-19T15:02:11.000000Z"
    },
    "topic": "Negligence",
    "tags": ["CONTRACT", "TORT"],
    "principles": "The principle of separate corporate personality...",
    "level": "200L",
    "court": {
      "id": 1,
      "name": "Supreme Court of Nigeria",
      "slug": "supreme-court-of-nigeria",
      "abbreviation": "SC",
      "country": {
        "id": 1,
        "name": "Nigeria",
        "code": "NG",
        "abbreviation": "NG",
        "slug": "nigeria",
        "created_at": "2026-01-19T15:02:11.000000Z",
        "updated_at": "2026-01-19T15:02:11.000000Z"
      },
      "created_at": "2026-01-19T15:02:11.000000Z",
      "updated_at": "2026-01-19T15:02:11.000000Z"
    },
    "judgment_date": "2003-07-03",
    "country": {
      "id": 1,
      "name": "Nigeria",
      "code": "NG",
      "abbreviation": "NG",
      "slug": "nigeria",
      "created_at": "2026-01-19T15:02:11.000000Z",
      "updated_at": "2026-01-19T15:02:11.000000Z"
    },
    "citation": "(2003) LAWEXA ELR 2541 NG SC",
    "judges": [
      {
        "id": 5,
        "name": "Justice Ayo Salami",
        "slug": "justice-ayo-salami",
        "created_at": "2026-01-19T15:02:11.000000Z",
        "updated_at": "2026-01-19T15:02:11.000000Z"
      }
    ],
    "judicial_precedent": "This case follows the precedent set in...",
    "similar_cases": [
      {
        "id": 100,
        "title": "Similar Case Title",
        "slug": "similar-case-title",
        "court": "CA",
        "judgment_date": "2005-01-15",
        "citation": "(2005) LAWEXA ELR 100 NG CA",
        "is_bookmarked": false,
        "bookmarks_count": 0,
        "views_count": 5
      }
    ],
    "cited_cases": [
      {
        "id": 200,
        "title": "Cited Case Title",
        "slug": "cited-case-title",
        "court": "SC",
        "judgment_date": "1998-03-20",
        "citation": "(1998) LAWEXA ELR 200 NG SC",
        "is_bookmarked": false,
        "bookmarks_count": 2,
        "views_count": 15
      }
    ],
    "cited_by": [],
    "cited_by_count": 0,
    "creator": {
      "id": 76,
      "name": "Researcher User"
    },
    "has_full_report": true,
    "files": [
      {
        "id": 5,
        "url": "https://s3.amazonaws.com/bucket/case-files/2026/02/abc123.pdf",
        "original_name": "case-report.pdf",
        "mime_type": "application/pdf",
        "size": 1048576,
        "created_at": "2026-02-10T13:04:00.000000Z"
      }
    ],
    "is_bookmarked": false,
    "bookmarks_count": 0,
    "views_count": 12,
    "body": "Full case body text...",
    "full_report": {
      "id": 1,
      "case_id": 8841,
      "full_text": "Complete full report text...",
      "created_at": "2026-01-19T15:02:11.000000Z",
      "updated_at": "2026-01-19T15:02:11.000000Z"
    },
    "limit_exceeded": false,
    "created_at": "2026-01-19T15:02:11.000000Z",
    "updated_at": "2026-01-19T15:02:11.000000Z"
  }
}
```

**Plan Limit Exceeded Response:**

When the user has exceeded their plan's case view limit, `body` and `full_report` are hidden:
```json
{
  "success": true,
  "message": "Case retrieved successfully.",
  "data": {
    "id": 8841,
    "title": "Macaulay v. RZB of Austria",
    "body": null,
    "full_report": null,
    "limit_exceeded": true,
    "limit_message": "Upgrade to view full case details.",
    "...": "other fields still present"
  }
}
```

---

### POST /api/cases

Create a new case. Slug and citation are auto-generated if not provided.

**Citation Format:** `(YYYY) LAWEXA ELR {ID} {COUNTRY_CODE} {COURT_ABBREVIATION}`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | max:500 |
| `body` | string | Yes | — |
| `slug` | string | No | max:500, lowercase-hyphenated |
| `course_id` | integer | No | must exist in courses |
| `topic` | string | No | max:255 |
| `tags` | array | No | array of strings, each max:100 |
| `principles` | string | No | — |
| `level` | string | No | max:50 |
| `court_id` | integer | No | must exist in courts |
| `judgment_date` | date | No | YYYY-MM-DD |
| `country_id` | integer | No | must exist in countries |
| `citation` | string | No | max:500 (auto-generated if omitted) |
| `judicial_precedent` | string | No | — |
| `full_report` | string | No | — |
| `judge_ids` | array | No | array of integers, each must exist in judges |
| `similar_case_ids` | array | No | array of integers, each must exist in court_cases |
| `cited_case_ids` | array | No | array of integers, each must exist in court_cases |

**Request Example:**
```json
{
  "title": "Smith v. Jones",
  "body": "The plaintiff brought action against the defendant...",
  "course_id": 1,
  "topic": "Negligence",
  "tags": ["TORT", "NEGLIGENCE"],
  "principles": "Duty of care applies when...",
  "level": "200L",
  "court_id": 1,
  "judgment_date": "2025-06-15",
  "country_id": 1,
  "judicial_precedent": "Following the decision in...",
  "full_report": "Complete text of the judgment...",
  "judge_ids": [5, 12],
  "similar_case_ids": [100, 200],
  "cited_case_ids": [300]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Case created successfully.",
  "data": {
    "id": 8842,
    "title": "Smith v. Jones",
    "slug": "smith-v-jones",
    "course": {
      "id": 1,
      "name": "Company Law",
      "slug": "company-law",
      "created_at": "2026-01-19T15:02:11.000000Z",
      "updated_at": "2026-01-19T15:02:11.000000Z"
    },
    "topic": "Negligence",
    "tags": ["TORT", "NEGLIGENCE"],
    "principles": "Duty of care applies when...",
    "level": "200L",
    "court": {
      "id": 1,
      "name": "Supreme Court of Nigeria",
      "slug": "supreme-court-of-nigeria",
      "abbreviation": "SC",
      "country": {
        "id": 1,
        "name": "Nigeria",
        "code": "NG",
        "abbreviation": "NG",
        "slug": "nigeria",
        "created_at": "2026-01-19T15:02:11.000000Z",
        "updated_at": "2026-01-19T15:02:11.000000Z"
      },
      "created_at": "2026-01-19T15:02:11.000000Z",
      "updated_at": "2026-01-19T15:02:11.000000Z"
    },
    "judgment_date": "2025-06-15",
    "country": {
      "id": 1,
      "name": "Nigeria",
      "code": "NG",
      "abbreviation": "NG",
      "slug": "nigeria",
      "created_at": "2026-01-19T15:02:11.000000Z",
      "updated_at": "2026-01-19T15:02:11.000000Z"
    },
    "citation": "(2025) LAWEXA ELR 8842 NG SC",
    "judges": [
      {
        "id": 5,
        "name": "Justice Ayo Salami",
        "slug": "justice-ayo-salami",
        "created_at": "2026-01-19T15:02:11.000000Z",
        "updated_at": "2026-01-19T15:02:11.000000Z"
      }
    ],
    "judicial_precedent": "Following the decision in...",
    "similar_cases": [],
    "cited_cases": [],
    "cited_by": [],
    "cited_by_count": 0,
    "has_full_report": true,
    "files": [],
    "is_bookmarked": false,
    "bookmarks_count": 0,
    "views_count": 0,
    "body": "The plaintiff brought action against the defendant...",
    "full_report": {
      "id": 100,
      "case_id": 8842,
      "full_text": "Complete text of the judgment...",
      "created_at": "2026-02-10T14:30:00.000000Z",
      "updated_at": "2026-02-10T14:30:00.000000Z"
    },
    "limit_exceeded": false,
    "created_at": "2026-02-10T14:30:00.000000Z",
    "updated_at": "2026-02-10T14:30:00.000000Z"
  }
}
```

**Validation Error (422) - Missing Required Fields:**
```json
{
  "success": false,
  "message": "Please provide a case title. (and 1 more error)",
  "errors": {
    "title": ["Please provide a case title."],
    "body": ["Please provide the case body."]
  }
}
```

**Validation Error (422) - Invalid Foreign Keys:**
```json
{
  "success": false,
  "message": "The selected course does not exist.",
  "errors": {
    "course_id": ["The selected course does not exist."]
  }
}
```

---

### PUT /api/cases/{case}

Update a case. Only send the fields you want to change. All fields use `sometimes` validation.

On update, `similar_case_ids` and `cited_case_ids` cannot include the case's own ID (self-reference validation). Passing these arrays replaces the existing relationships entirely (sync behavior).

**Request Body:** Same fields as create, but all are optional.

**Request Example:**
```json
{
  "title": "Updated Title",
  "tags": ["UPDATED_TAG"],
  "judge_ids": [5, 12, 20]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Case updated successfully.",
  "data": {
    "id": 8842,
    "title": "Updated Title",
    "...": "full CaseResource shape"
  }
}
```

**Validation Error (422) - Self-Reference:**
```json
{
  "success": false,
  "message": "A case cannot be similar to itself.",
  "errors": {
    "similar_case_ids.0": ["A case cannot be similar to itself."]
  }
}
```

---

### DELETE /api/cases/{case}

Soft-delete a case.

**Response (200):**
```json
{
  "success": true,
  "message": "Case deleted successfully.",
  "data": null
}
```

---

### POST /api/cases/{id}/restore

Restore a soft-deleted case. Admin only.

**Response (200):**
```json
{
  "success": true,
  "message": "Case restored successfully.",
  "data": {
    "...": "full CaseResource shape"
  }
}
```

---

## Autocomplete

### Authentication

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/case-topics` | GET | Yes | Any |
| `/api/case-tags` | GET | Yes | Any |

---

### GET /api/case-topics

Search distinct topic values from existing cases. Returns up to 20 results sorted alphabetically. Without a search term, returns the first 20 topics alphabetically.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | No | Partial match filter (case-insensitive) |

**Response (With Results):**
```json
{
  "success": true,
  "message": "Topics retrieved successfully.",
  "data": [
    "Administrative Law",
    "Constitutional Law",
    "Contract Law",
    "Criminal Law",
    "Negligence"
  ]
}
```

**Response (With Search - `?search=neg`):**
```json
{
  "success": true,
  "message": "Topics retrieved successfully.",
  "data": [
    "Negligence",
    "Negligence and Duty of Care"
  ]
}
```

**Response (No Matches):**
```json
{
  "success": true,
  "message": "Topics retrieved successfully.",
  "data": []
}
```

**Notes:**
- Returns a **flat array of strings**, not objects
- Sourced from the `topic` column on `court_cases`, deduplicated
- Maximum 20 results per request
- The frontend should allow users to select a suggestion or type a new topic freely

---

### GET /api/case-tags

Search distinct tag values from existing cases. Tags are stored as JSON arrays on each case, so this endpoint flattens, deduplicates, and filters across all cases. Returns up to 20 results sorted alphabetically.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | No | Partial match filter (case-insensitive) |

**Response (With Results):**
```json
{
  "success": true,
  "message": "Tags retrieved successfully.",
  "data": [
    "COMMERCIAL LAW",
    "CONTRACT",
    "CRIMINAL LAW",
    "LIFTING THE VEIL",
    "SEPARATE LEGAL PERSONALITY",
    "TORT"
  ]
}
```

**Response (With Search - `?search=contract`):**
```json
{
  "success": true,
  "message": "Tags retrieved successfully.",
  "data": [
    "CONTRACT",
    "CONTRACT LAW"
  ]
}
```

**Response (No Matches):**
```json
{
  "success": true,
  "message": "Tags retrieved successfully.",
  "data": []
}
```

**Notes:**
- Returns a **flat array of strings**, not objects
- Sourced from the JSON `tags` column across all cases, deduplicated
- Maximum 20 results per request
- Tags are submitted as an array when creating/updating a case: `"tags": ["CONTRACT", "TORT"]`

---

## Case Files

### Authentication

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/cases/{case}/files` | GET | Yes | Researcher+ |
| `/api/cases/{case}/files` | POST | Yes | Researcher+ |

The `{case}` parameter is the case ID (integer).

---

### GET /api/cases/{case}/files

List all completed files attached to a case, ordered by most recently uploaded.

**Response (With Files):**
```json
{
  "success": true,
  "message": "Case files retrieved successfully.",
  "data": [
    {
      "id": 5,
      "url": "https://s3.amazonaws.com/bucket/case-files/2026/02/abc123.pdf",
      "original_name": "case-report-final.pdf",
      "mime_type": "application/pdf",
      "size": 1048576,
      "created_at": "2026-02-10T13:04:00.000000Z"
    }
  ]
}
```

**Response (No Files):**
```json
{
  "success": true,
  "message": "Case files retrieved successfully.",
  "data": []
}
```

---

### POST /api/cases/{case}/files

Upload a file to a case. Files are stored on S3 with content hashing for deduplication.

**Request:** `Content-Type: multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | The file to upload |

**Allowed File Types:**

| Category | Extensions | MIME Types |
|----------|------------|------------|
| Documents | pdf, doc, docx, txt, rtf | application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain, text/rtf |
| Images | jpg, jpeg, png, gif, webp | image/jpeg, image/png, image/gif, image/webp |

**Constraints:**
- Maximum file size: **20MB** (20,480 KB)
- Maximum files per case: **10**

**Response (201):**
```json
{
  "success": true,
  "message": "File uploaded successfully.",
  "data": {
    "id": 5,
    "url": "https://s3.amazonaws.com/bucket/case-files/2026/02/abc123.pdf",
    "original_name": "case-report-final.pdf",
    "mime_type": "application/pdf",
    "size": 1048576,
    "created_at": "2026-02-10T13:04:00.000000Z"
  }
}
```

**Validation Errors:**
```json
{
  "success": false,
  "message": "Please select a file to upload.",
  "errors": {
    "file": ["Please select a file to upload."]
  }
}
```

```json
{
  "success": false,
  "message": "The file must be a PDF, DOC, DOCX, TXT, RTF, JPG, JPEG, PNG, GIF, or WebP.",
  "errors": {
    "file": ["The file must be a PDF, DOC, DOCX, TXT, RTF, JPG, JPEG, PNG, GIF, or WebP."]
  }
}
```

```json
{
  "success": false,
  "message": "The file may not be larger than 20MB.",
  "errors": {
    "file": ["The file may not be larger than 20MB."]
  }
}
```

**Max Files Reached (422):**
```json
{
  "success": false,
  "message": "Maximum of 10 files per case reached.",
  "errors": null
}
```

---

## File Management

### Authentication

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/files/{file}/download` | GET | Yes | See policy below |
| `/api/files/{file}` | DELETE | Yes | See policy below |

**File Policy:**

| Action | Who Can Access |
|--------|---------------|
| Download | Uploader, Admin, fileable owner, or Researcher+ for case-report files |
| Delete | Uploader, Admin, or Researcher+ for case-report files |

---

### GET /api/files/{file}/download

Download a file. Returns the file binary content with appropriate headers.

**Response:** Binary file download with `Content-Disposition` header.

---

### DELETE /api/files/{file}

Delete a file from S3 and the database.

**Response (200):**
```json
{
  "success": true,
  "message": "File deleted successfully.",
  "data": null
}
```

---

## Error Responses

All error responses follow the same envelope format.

### 401 Unauthenticated

Returned when no valid Bearer token is provided.

```json
{
  "success": false,
  "message": "Unauthenticated.",
  "errors": null
}
```

### 403 Forbidden

Returned when the user lacks the required role.

```json
{
  "success": false,
  "message": "Insufficient permissions. This action requires at least researcher role.",
  "errors": null
}
```

### 404 Not Found

Returned when the resource does not exist.

```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

### 409 Conflict

Returned when deleting a resource that has dependent records.

```json
{
  "success": false,
  "message": "Cannot delete this country because it has associated cases.",
  "errors": null
}
```

### 422 Validation Error

Returned when request validation fails. The `errors` object contains field-specific error arrays.

```json
{
  "success": false,
  "message": "Please provide a case title. (and 1 more error)",
  "errors": {
    "title": ["Please provide a case title."],
    "body": ["Please provide the case body."]
  }
}
```

---

## Data Models

### Country Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Country ID |
| `name` | string | Country name |
| `code` | string | ISO country code (max 3 chars) |
| `abbreviation` | string | Country abbreviation |
| `slug` | string | URL-friendly slug |
| `creator` | object\|null | Creator info (when loaded) |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### Court Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Court ID |
| `name` | string | Court name |
| `slug` | string | URL-friendly slug |
| `abbreviation` | string | Court abbreviation (e.g. "SC", "CA") |
| `country` | object\|null | Nested Country Resource (when loaded) |
| `creator` | object\|null | Creator info (when loaded) |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### Course Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Course ID |
| `name` | string | Course name |
| `slug` | string | URL-friendly slug |
| `creator` | object\|null | Creator info (when loaded) |
| `cases_count` | integer\|null | Number of cases (when counted) |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### Judge Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Judge ID |
| `name` | string | Judge name |
| `slug` | string | URL-friendly slug |
| `creator` | object\|null | Creator info (when loaded) |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### Case Resource (Full)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Case ID |
| `title` | string | Case title |
| `slug` | string | URL-friendly slug |
| `course` | object\|null | Nested Course Resource (when loaded) |
| `topic` | string\|null | Legal topic |
| `tags` | array\|null | Array of tag strings |
| `principles` | string\|null | Legal principles |
| `level` | string\|null | Academic level (free text, e.g. "200L") |
| `court` | object\|null | Nested Court Resource with country (when loaded) |
| `judgment_date` | string\|null | Date in YYYY-MM-DD format |
| `country` | object\|null | Nested Country Resource (when loaded) |
| `citation` | string\|null | Auto-generated citation |
| `judges` | array | Array of Judge Resources (when loaded) |
| `judicial_precedent` | string\|null | Judicial precedent text |
| `similar_cases` | array | Array of Case Summary Resources |
| `cited_cases` | array | Array of Case Summary Resources |
| `cited_by` | array | Array of Case Summary Resources |
| `cited_by_count` | integer | Number of cases citing this case |
| `creator` | object\|null | Creator info (when loaded) |
| `has_full_report` | boolean | Whether a full report exists |
| `files` | array | Array of File Resources (when loaded) |
| `is_bookmarked` | boolean | Whether current user bookmarked this case |
| `bookmarks_count` | integer | Total bookmark count |
| `views_count` | integer | Total view count |
| `body` | string\|null | Case body (null if plan limit exceeded) |
| `full_report` | object\|null | Full Report Resource (null if plan limit exceeded) |
| `limit_exceeded` | boolean | Whether user has exceeded their plan limit |
| `limit_message` | string\|null | Upgrade message (only when limit_exceeded is true) |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### Case Summary Resource (List/Relations)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Case ID |
| `title` | string | Case title |
| `slug` | string | URL-friendly slug |
| `court` | string\|null | Court abbreviation string (not object) |
| `judgment_date` | string\|null | Date in YYYY-MM-DD format |
| `citation` | string\|null | Case citation |
| `is_bookmarked` | boolean | Whether current user bookmarked this case |
| `bookmarks_count` | integer | Total bookmark count |
| `views_count` | integer | Total view count |

### Full Report Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Report ID |
| `case_id` | integer | Parent case ID |
| `full_text` | string | Complete report text |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### File Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | File ID |
| `url` | string\|null | Full URL to file on S3 |
| `original_name` | string | Original uploaded file name |
| `mime_type` | string | Detected MIME type |
| `size` | integer | File size in bytes |
| `created_at` | datetime | ISO 8601 timestamp |

### Pagination Object

| Field | Type | Description |
|-------|------|-------------|
| `current_page` | integer | Current page number |
| `per_page` | integer | Items per page |
| `total` | integer | Total item count |
| `last_page` | integer | Last page number |
| `from` | integer\|null | First item number on page |
| `to` | integer\|null | Last item number on page |

### Links Object

| Field | Type | Description |
|-------|------|-------------|
| `first` | string | URL to first page |
| `last` | string | URL to last page |
| `prev` | string\|null | URL to previous page (null on first page) |
| `next` | string\|null | URL to next page (null on last page) |

---

## Access Control Summary

| Action | Role Required |
|--------|---------------|
| List countries/courts/courses/judges | Any authenticated user |
| Create/update countries/courts/courses/judges | Researcher+ |
| Delete countries/courts/judges | Admin |
| Delete/restore courses | Admin |
| List/search cases | Any authenticated user |
| View case detail | Any authenticated user |
| Create/update/delete cases | Researcher+ |
| Restore cases | Admin |
| Search case topics/tags | Any authenticated user |
| List/upload case files | Researcher+ |
| Download file | Uploader, Admin, fileable owner, or Researcher+ (case-report) |
| Delete file | Uploader, Admin, or Researcher+ (case-report) |

---

## Quick-Add Workflow

The case form supports "quick-add" for lookup tables. When a user needs a country, court, course, or judge that doesn't exist, they can create it inline without leaving the case form:

1. User searches the dropdown (e.g. `GET /api/courts?search=custom`)
2. If no match found, frontend shows a "Create New" option
3. User fills in minimal required fields (e.g. just `name` for a court)
4. Frontend calls `POST /api/courts` to create the record
5. The newly created record's `id` is used in the case create/update payload

All quick-add endpoints (POST for countries, courts, courses, judges) require **Researcher+** role, matching the case create/update permission level.
