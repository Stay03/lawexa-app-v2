# Phase 5: Cases - API Documentation

## Overview

Phase 5 implements case law management including courts, judges, countries, and legal cases. This module enables storing and retrieving legal precedents with full metadata including court information, presiding judges, and case details.

---

## Table of Contents

1. [Countries](#countries)
2. [Courts](#courts)
3. [Judges](#judges)
4. [Cases](#cases)
5. [Error Responses](#error-responses)
6. [Data Models](#data-models)

---

## Countries

### Authentication

All endpoints require `auth:sanctum` middleware. Write operations require admin role.

| Endpoint | Method | Auth Required | Admin Only |
|----------|--------|---------------|------------|
| `/api/countries` | GET | Yes | No |
| `/api/countries` | POST | Yes | Yes |
| `/api/countries/{id}` | PUT | Yes | Yes |
| `/api/countries/{id}` | DELETE | Yes | Yes |

---

### GET /api/countries

List paginated countries.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | - | Filter by country name |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Response:**
```json
{
  "success": true,
  "message": "Countries retrieved successfully.",
  "data": [
    {
      "id": 2,
      "name": "Ghana",
      "code": "GH",
      "abbreviation": "GH",
      "slug": "ghana",
      "creator": {
        "id": 14,
        "name": "Camden Walter",
        "email": "admin_test@lawexa.com",
        "role": "admin",
        "is_creator": false,
        "is_verified": true,
        "auth_provider": "email",
        "avatar_url": null,
        "created_at": "2026-01-09T23:06:32.000000Z"
      },
      "created_at": "2026-01-09T23:06:58.000000Z",
      "updated_at": "2026-01-09T23:06:58.000000Z"
    },
    {
      "id": 1,
      "name": "Nigeria",
      "code": "NG",
      "abbreviation": "NG",
      "slug": "nigeria",
      "creator": {
        "id": 14,
        "name": "Camden Walter",
        "email": "admin_test@lawexa.com",
        "role": "admin",
        "is_creator": false,
        "is_verified": true,
        "auth_provider": "email",
        "avatar_url": null,
        "created_at": "2026-01-09T23:06:32.000000Z"
      },
      "created_at": "2026-01-09T23:06:58.000000Z",
      "updated_at": "2026-01-09T23:06:58.000000Z"
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

**Empty Response:**
```json
{
  "success": true,
  "message": "Countries retrieved successfully.",
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
    "first": "http://127.0.0.1:8000/api/countries?page=1",
    "last": "http://127.0.0.1:8000/api/countries?page=1",
    "prev": null,
    "next": null
  }
}
```

---

### POST /api/countries

Create a new country. Requires admin role.

**Request Body:**
```json
{
  "name": "Nigeria",
  "code": "NG"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | Max 255 chars |
| `code` | string | Yes | 2-3 chars, unique |

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Country created successfully.",
  "data": {
    "id": 1,
    "name": "Nigeria",
    "code": "NG",
    "abbreviation": "NG",
    "slug": "nigeria",
    "creator": {
      "id": 14,
      "name": "Camden Walter",
      "email": "admin_test@lawexa.com",
      "role": "admin",
      "is_creator": false,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "created_at": "2026-01-09T23:06:32.000000Z"
    },
    "created_at": "2026-01-09T23:06:58.000000Z",
    "updated_at": "2026-01-09T23:06:58.000000Z"
  }
}
```

**Validation Error - Missing Name:**
```json
{
  "success": false,
  "message": "Please provide a country name.",
  "errors": {
    "name": ["Please provide a country name."]
  }
}
```

**Validation Error - Missing Code:**
```json
{
  "success": false,
  "message": "Please provide a country code.",
  "errors": {
    "code": ["Please provide a country code."]
  }
}
```

**Validation Error - Duplicate Code:**
```json
{
  "success": false,
  "message": "A country with this code already exists.",
  "errors": {
    "code": ["A country with this code already exists."]
  }
}
```

**Notes:**
- Slug is auto-generated from the name
- The authenticated admin user is automatically set as the creator

---

### PUT /api/countries/{id}

Update a country. Requires admin role.

**Request Body:**
```json
{
  "name": "Federal Republic of Nigeria"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | No | Max 255 chars |
| `code` | string | No | 2-3 chars, unique (excluding current) |

**Response:**
```json
{
  "success": true,
  "message": "Country updated successfully.",
  "data": {
    "id": 1,
    "name": "Federal Republic of Nigeria",
    "code": "NG",
    "abbreviation": "NG",
    "slug": "nigeria",
    "creator": {
      "id": 14,
      "name": "Camden Walter",
      "email": "admin_test@lawexa.com",
      "role": "admin",
      "is_creator": false,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "created_at": "2026-01-09T23:06:32.000000Z"
    },
    "created_at": "2026-01-09T23:06:58.000000Z",
    "updated_at": "2026-01-09T23:07:16.000000Z"
  }
}
```

**Not Found:**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

---

### DELETE /api/countries/{id}

Delete a country. Requires admin role.

**Response:**
```json
{
  "success": true,
  "message": "Country deleted successfully.",
  "data": null
}
```

**Not Found:**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

---

## Courts

### Authentication

All endpoints require `auth:sanctum` middleware. Write operations require admin role.

| Endpoint | Method | Auth Required | Admin Only |
|----------|--------|---------------|------------|
| `/api/courts` | GET | Yes | No |
| `/api/courts` | POST | Yes | Yes |
| `/api/courts/{id}` | PUT | Yes | Yes |
| `/api/courts/{id}` | DELETE | Yes | Yes |

---

### GET /api/courts

List paginated courts.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | - | Filter by court name |
| `country_id` | integer | - | Filter by country |
| `per_page` | integer | `15` | Items per page (1-100) |
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
      "abbreviation": "SCN",
      "country": {
        "id": 1,
        "name": "Federal Republic of Nigeria",
        "code": "NG",
        "abbreviation": "NG",
        "slug": "nigeria",
        "created_at": "2026-01-09T23:06:58.000000Z",
        "updated_at": "2026-01-09T23:07:16.000000Z"
      },
      "creator": {
        "id": 14,
        "name": "Camden Walter",
        "email": "admin_test@lawexa.com",
        "role": "admin",
        "is_creator": false,
        "is_verified": true,
        "auth_provider": "email",
        "avatar_url": null,
        "created_at": "2026-01-09T23:06:32.000000Z"
      },
      "created_at": "2026-01-09T23:07:36.000000Z",
      "updated_at": "2026-01-09T23:07:36.000000Z"
    },
    {
      "id": 2,
      "name": "Court of Appeal",
      "slug": "court-of-appeal",
      "abbreviation": "CA",
      "country": {
        "id": 1,
        "name": "Federal Republic of Nigeria",
        "code": "NG",
        "abbreviation": "NG",
        "slug": "nigeria",
        "created_at": "2026-01-09T23:06:58.000000Z",
        "updated_at": "2026-01-09T23:07:16.000000Z"
      },
      "creator": {
        "id": 14,
        "name": "Camden Walter",
        "email": "admin_test@lawexa.com",
        "role": "admin",
        "is_creator": false,
        "is_verified": true,
        "auth_provider": "email",
        "avatar_url": null,
        "created_at": "2026-01-09T23:06:32.000000Z"
      },
      "created_at": "2026-01-09T23:07:36.000000Z",
      "updated_at": "2026-01-09T23:07:36.000000Z"
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
    "first": "http://127.0.0.1:8000/api/courts?page=1",
    "last": "http://127.0.0.1:8000/api/courts?page=1",
    "prev": null,
    "next": null
  }
}
```

---

### POST /api/courts

Create a new court. Requires admin role.

**Request Body:**
```json
{
  "name": "Supreme Court of Nigeria",
  "abbreviation": "SCN",
  "country_id": 1
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | Max 255 chars |
| `abbreviation` | string | No | Max 20 chars |
| `country_id` | integer | No | Must exist in countries table |

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Court created successfully.",
  "data": {
    "id": 1,
    "name": "Supreme Court of Nigeria",
    "slug": "supreme-court-of-nigeria",
    "abbreviation": "SCN",
    "country": {
      "id": 1,
      "name": "Federal Republic of Nigeria",
      "code": "NG",
      "abbreviation": "NG",
      "slug": "nigeria",
      "created_at": "2026-01-09T23:06:58.000000Z",
      "updated_at": "2026-01-09T23:07:16.000000Z"
    },
    "creator": {
      "id": 14,
      "name": "Camden Walter",
      "email": "admin_test@lawexa.com",
      "role": "admin",
      "is_creator": false,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "created_at": "2026-01-09T23:06:32.000000Z"
    },
    "created_at": "2026-01-09T23:07:36.000000Z",
    "updated_at": "2026-01-09T23:07:36.000000Z"
  }
}
```

**Validation Error - Missing Name:**
```json
{
  "success": false,
  "message": "Please provide a court name.",
  "errors": {
    "name": ["Please provide a court name."]
  }
}
```

**Validation Error - Invalid Country:**
```json
{
  "success": false,
  "message": "The selected country does not exist.",
  "errors": {
    "country_id": ["The selected country does not exist."]
  }
}
```

**Notes:**
- Slug is auto-generated from the name
- The authenticated admin user is automatically set as the creator

---

### PUT /api/courts/{id}

Update a court. Requires admin role.

**Request Body:**
```json
{
  "name": "Supreme Court of Nigeria (Updated)"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | No | Max 255 chars |
| `abbreviation` | string | No | Max 20 chars |
| `country_id` | integer | No | Must exist in countries table |

**Response:**
```json
{
  "success": true,
  "message": "Court updated successfully.",
  "data": {
    "id": 1,
    "name": "Supreme Court of Nigeria (Updated)",
    "slug": "supreme-court-of-nigeria",
    "abbreviation": "SCN",
    "country": {
      "id": 1,
      "name": "Federal Republic of Nigeria",
      "code": "NG",
      "abbreviation": "NG",
      "slug": "nigeria",
      "created_at": "2026-01-09T23:06:58.000000Z",
      "updated_at": "2026-01-09T23:07:16.000000Z"
    },
    "creator": {
      "id": 14,
      "name": "Camden Walter",
      "email": "admin_test@lawexa.com",
      "role": "admin",
      "is_creator": false,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "created_at": "2026-01-09T23:06:32.000000Z"
    },
    "created_at": "2026-01-09T23:07:36.000000Z",
    "updated_at": "2026-01-09T23:07:51.000000Z"
  }
}
```

**Not Found:**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

---

### DELETE /api/courts/{id}

Delete a court. Requires admin role.

**Response:**
```json
{
  "success": true,
  "message": "Court deleted successfully.",
  "data": null
}
```

**Not Found:**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

---

## Judges

### Authentication

All endpoints require `auth:sanctum` middleware. Write operations require admin role.

| Endpoint | Method | Auth Required | Admin Only |
|----------|--------|---------------|------------|
| `/api/judges` | GET | Yes | No |
| `/api/judges` | POST | Yes | Yes |
| `/api/judges/{id}` | PUT | Yes | Yes |
| `/api/judges/{id}` | DELETE | Yes | Yes |

---

### GET /api/judges

List paginated judges.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | - | Filter by judge name |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Response:**
```json
{
  "success": true,
  "message": "Judges retrieved successfully.",
  "data": [
    {
      "id": 1,
      "name": "Justice Olukayode Ariwoola",
      "slug": "justice-olukayode-ariwoola",
      "creator": {
        "id": 14,
        "name": "Camden Walter",
        "email": "admin_test@lawexa.com",
        "role": "admin",
        "is_creator": false,
        "is_verified": true,
        "auth_provider": "email",
        "avatar_url": null,
        "created_at": "2026-01-09T23:06:32.000000Z"
      },
      "created_at": "2026-01-09T23:08:10.000000Z",
      "updated_at": "2026-01-09T23:08:10.000000Z"
    },
    {
      "id": 2,
      "name": "Justice Mary Odili",
      "slug": "justice-mary-odili",
      "creator": {
        "id": 14,
        "name": "Camden Walter",
        "email": "admin_test@lawexa.com",
        "role": "admin",
        "is_creator": false,
        "is_verified": true,
        "auth_provider": "email",
        "avatar_url": null,
        "created_at": "2026-01-09T23:06:32.000000Z"
      },
      "created_at": "2026-01-09T23:08:11.000000Z",
      "updated_at": "2026-01-09T23:08:11.000000Z"
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
    "first": "http://127.0.0.1:8000/api/judges?page=1",
    "last": "http://127.0.0.1:8000/api/judges?page=1",
    "prev": null,
    "next": null
  }
}
```

---

### POST /api/judges

Create a new judge. Requires admin role.

**Request Body:**
```json
{
  "name": "Justice Olukayode Ariwoola",
  "title": "Chief Justice of Nigeria"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | Max 255 chars |
| `title` | string | No | Max 255 chars |

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Judge created successfully.",
  "data": {
    "id": 1,
    "name": "Justice Olukayode Ariwoola",
    "slug": "justice-olukayode-ariwoola",
    "creator": {
      "id": 14,
      "name": "Camden Walter",
      "email": "admin_test@lawexa.com",
      "role": "admin",
      "is_creator": false,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "created_at": "2026-01-09T23:06:32.000000Z"
    },
    "created_at": "2026-01-09T23:08:10.000000Z",
    "updated_at": "2026-01-09T23:08:10.000000Z"
  }
}
```

**Validation Error - Missing Name:**
```json
{
  "success": false,
  "message": "Please provide the judge name.",
  "errors": {
    "name": ["Please provide the judge name."]
  }
}
```

**Notes:**
- Slug is auto-generated from the name
- The authenticated admin user is automatically set as the creator

---

### PUT /api/judges/{id}

Update a judge. Requires admin role.

**Request Body:**
```json
{
  "name": "Hon. Justice Olukayode Ariwoola"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | No | Max 255 chars |
| `title` | string | No | Max 255 chars |

**Response:**
```json
{
  "success": true,
  "message": "Judge updated successfully.",
  "data": {
    "id": 1,
    "name": "Hon. Justice Olukayode Ariwoola",
    "slug": "justice-olukayode-ariwoola",
    "creator": {
      "id": 14,
      "name": "Camden Walter",
      "email": "admin_test@lawexa.com",
      "role": "admin",
      "is_creator": false,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "created_at": "2026-01-09T23:06:32.000000Z"
    },
    "created_at": "2026-01-09T23:08:10.000000Z",
    "updated_at": "2026-01-09T23:08:24.000000Z"
  }
}
```

**Not Found:**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

---

### DELETE /api/judges/{id}

Delete a judge. Requires admin role.

**Response:**
```json
{
  "success": true,
  "message": "Judge deleted successfully.",
  "data": null
}
```

**Not Found:**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

---

## Cases

### Authentication

All endpoints require `auth:sanctum` middleware. Write operations require researcher role or higher.

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/cases` | GET | Yes | Any |
| `/api/cases` | POST | Yes | Researcher+ |
| `/api/cases/{slug}` | GET | Yes | Any |
| `/api/cases/{id}` | PUT | Yes | Researcher+ |
| `/api/cases/{id}` | DELETE | Yes | Researcher+ |
| `/api/cases/{id}/restore` | POST | Yes | Researcher+ |

---

### GET /api/cases

List paginated cases with optional filters.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | - | Filter by case title |
| `court_id` | integer | - | Filter by court |
| `country_id` | integer | - | Filter by country |
| `year` | integer | - | Filter by judgment year |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Response:**
```json
{
  "success": true,
  "message": "Cases retrieved successfully.",
  "data": [
    {
      "id": 2,
      "title": "Tinubu v. Atiku",
      "slug": "tinubu-v-atiku",
      "excerpt": "The respondent filed a cross-appeal regarding the lower tribunal decision.",
      "topic": null,
      "tags": null,
      "principles": null,
      "level": null,
      "course": null,
      "court": {
        "name": "Supreme Court of Nigeria (Updated)",
        "slug": "supreme-court-of-nigeria",
        "abbreviation": "SCN"
      },
      "country": null,
      "judgment_date": null,
      "citation": null,
      "meta": {
        "title": "Tinubu v. Atiku",
        "description": "The respondent filed a cross-appeal regarding the lower tribunal decision.",
        "canonical": "http://127.0.0.1:8000/cases/tinubu-v-atiku"
      }
    },
    {
      "id": 1,
      "title": "INEC v. Peter Obi (Updated)",
      "slug": "inec-v-obi",
      "excerpt": "The petitioner filed a case challenging the results of the 2023 presidential election citing irregularities and non-compliance with electoral guidelines.",
      "topic": null,
      "tags": null,
      "principles": null,
      "level": null,
      "course": null,
      "court": {
        "name": "Supreme Court of Nigeria (Updated)",
        "slug": "supreme-court-of-nigeria",
        "abbreviation": "SCN"
      },
      "country": null,
      "judgment_date": null,
      "citation": null,
      "meta": {
        "title": "INEC v. Peter Obi (Updated)",
        "description": "The petitioner filed a case challenging the results of the 2023 presidential election citing irregularities and non-compliance with electoral guidelines.",
        "canonical": "http://127.0.0.1:8000/cases/inec-v-obi"
      }
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
    "first": "http://127.0.0.1:8000/api/cases?page=1",
    "last": "http://127.0.0.1:8000/api/cases?page=1",
    "prev": null,
    "next": null
  }
}
```

**Search Example:**

`GET /api/cases?search=Obi`

Returns only cases matching "Obi" in the title.

**Pagination Example:**

`GET /api/cases?per_page=1&page=2`

```json
{
  "success": true,
  "message": "Cases retrieved successfully.",
  "data": [...],
  "pagination": {
    "current_page": 2,
    "per_page": 1,
    "total": 2,
    "last_page": 2,
    "from": 2,
    "to": 2
  },
  "links": {
    "first": "http://127.0.0.1:8000/api/cases?page=1",
    "last": "http://127.0.0.1:8000/api/cases?page=2",
    "prev": "http://127.0.0.1:8000/api/cases?page=1",
    "next": null
  }
}
```

---

### POST /api/cases

Create a new case. Requires researcher role or higher.

**Request Body:**
```json
{
  "title": "Inec v. Obi",
  "body": "The petitioner filed a case challenging the results of the 2023 presidential election citing irregularities and non-compliance with electoral guidelines.",
  "suit_number": "SC/CV/123/2023",
  "court_id": 1,
  "year": 2023,
  "summary": "Election tribunal case regarding the 2023 presidential election",
  "status": "decided",
  "judge_ids": [1, 2]
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | Max 255 chars |
| `body` | string | Yes | Case content |
| `suit_number` | string | No | Max 100 chars |
| `court_id` | integer | No | Must exist in courts table |
| `year` | integer | No | 4-digit year |
| `summary` | string | No | Brief summary |
| `status` | string | No | Case status |
| `judge_ids` | array | No | Array of judge IDs |
| `country_id` | integer | No | Must exist in countries table |
| `citation` | string | No | Legal citation |
| `judgment_date` | date | No | Date of judgment |

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Case created successfully.",
  "data": {
    "id": 1,
    "title": "Inec v. Obi",
    "slug": "inec-v-obi",
    "body": "The petitioner filed a case challenging the results of the 2023 presidential election citing irregularities and non-compliance with electoral guidelines.",
    "course": null,
    "topic": null,
    "tags": null,
    "principles": null,
    "level": null,
    "court": {
      "id": 1,
      "name": "Supreme Court of Nigeria (Updated)",
      "slug": "supreme-court-of-nigeria",
      "abbreviation": "SCN",
      "created_at": "2026-01-09T23:07:36.000000Z",
      "updated_at": "2026-01-09T23:07:51.000000Z"
    },
    "judgment_date": null,
    "country": null,
    "citation": null,
    "judges": [],
    "judicial_precedent": null,
    "creator": {
      "id": 14,
      "name": "Camden Walter",
      "email": "admin_test@lawexa.com",
      "role": "admin",
      "is_creator": false,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "created_at": "2026-01-09T23:06:32.000000Z"
    },
    "created_at": "2026-01-09T23:08:50.000000Z",
    "updated_at": "2026-01-09T23:08:50.000000Z"
  }
}
```

**Validation Error - Missing Required Fields:**
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

**Validation Error - Invalid Court:**
```json
{
  "success": false,
  "message": "The selected court does not exist.",
  "errors": {
    "court_id": ["The selected court does not exist."]
  }
}
```

**Validation Error - Invalid Judges:**
```json
{
  "success": false,
  "message": "One or more selected judges do not exist. (and 1 more error)",
  "errors": {
    "judge_ids.0": ["One or more selected judges do not exist."],
    "judge_ids.1": ["One or more selected judges do not exist."]
  }
}
```

**Permission Error:**
```json
{
  "success": false,
  "message": "Insufficient permissions. This action requires at least researcher role."
}
```

**Notes:**
- Slug is auto-generated from the title
- The authenticated user is automatically set as the creator
- Cases support soft deletion

---

### GET /api/cases/{slug}

Get a specific case by its slug.

**Response:**
```json
{
  "success": true,
  "message": "Case retrieved successfully.",
  "data": {
    "id": 1,
    "title": "Inec v. Obi",
    "slug": "inec-v-obi",
    "excerpt": "The petitioner filed a case challenging the results of the 2023 presidential election citing irregularities and non-compliance with electoral guidelines.",
    "topic": null,
    "tags": null,
    "principles": null,
    "level": null,
    "course": null,
    "court": {
      "name": "Supreme Court of Nigeria (Updated)",
      "slug": "supreme-court-of-nigeria",
      "abbreviation": "SCN"
    },
    "country": null,
    "judges": [],
    "judgment_date": null,
    "citation": null,
    "meta": {
      "title": "Inec v. Obi",
      "description": "The petitioner filed a case challenging the results of the 2023 presidential election citing irregularities and non-compliance with electoral guidelines.",
      "canonical": "http://127.0.0.1:8000/cases/inec-v-obi"
    }
  }
}
```

**Not Found:**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

**Note:** The show endpoint uses **slug** for lookup, not ID.

---

### PUT /api/cases/{id}

Update a case. Requires researcher role or higher.

**Request Body:**
```json
{
  "title": "INEC v. Peter Obi (Updated)",
  "judge_ids": [1]
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | No | Max 255 chars |
| `body` | string | No | Case content |
| `court_id` | integer | No | Must exist in courts table |
| `judge_ids` | array | No | Array of judge IDs |
| `country_id` | integer | No | Must exist in countries table |

**Response:**
```json
{
  "success": true,
  "message": "Case updated successfully.",
  "data": {
    "id": 1,
    "title": "INEC v. Peter Obi (Updated)",
    "slug": "inec-v-obi",
    "body": "The petitioner filed a case challenging the results of the 2023 presidential election citing irregularities and non-compliance with electoral guidelines.",
    "course": null,
    "topic": null,
    "tags": null,
    "principles": null,
    "level": null,
    "court": {
      "id": 1,
      "name": "Supreme Court of Nigeria (Updated)",
      "slug": "supreme-court-of-nigeria",
      "abbreviation": "SCN",
      "created_at": "2026-01-09T23:07:36.000000Z",
      "updated_at": "2026-01-09T23:07:51.000000Z"
    },
    "judgment_date": null,
    "country": null,
    "citation": null,
    "judges": [
      {
        "id": 1,
        "name": "Hon. Justice Olukayode Ariwoola",
        "slug": "justice-olukayode-ariwoola",
        "created_at": "2026-01-09T23:08:10.000000Z",
        "updated_at": "2026-01-09T23:08:24.000000Z"
      }
    ],
    "judicial_precedent": null,
    "creator": {
      "id": 14,
      "name": "Camden Walter",
      "email": "admin_test@lawexa.com",
      "role": "admin",
      "is_creator": false,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "created_at": "2026-01-09T23:06:32.000000Z"
    },
    "created_at": "2026-01-09T23:08:50.000000Z",
    "updated_at": "2026-01-09T23:09:32.000000Z"
  }
}
```

**Not Found:**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

**Note:** The update endpoint uses **ID** for lookup.

---

### DELETE /api/cases/{id}

Soft delete a case. Requires researcher role or higher.

**Response:**
```json
{
  "success": true,
  "message": "Case deleted successfully.",
  "data": null
}
```

**Not Found:**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

**Notes:**
- Soft-deleted cases are excluded from normal queries
- Soft-deleted cases can be restored

---

### POST /api/cases/{id}/restore

Restore a soft-deleted case. Requires researcher role or higher.

**Response:**
```json
{
  "success": true,
  "message": "Case restored successfully.",
  "data": {
    "id": 1,
    "title": "INEC v. Peter Obi (Updated)",
    "slug": "inec-v-obi",
    "body": "The petitioner filed a case challenging the results of the 2023 presidential election citing irregularities and non-compliance with electoral guidelines.",
    "course": null,
    "topic": null,
    "tags": null,
    "principles": null,
    "level": null,
    "court": {
      "id": 1,
      "name": "Supreme Court of Nigeria (Updated)",
      "slug": "supreme-court-of-nigeria",
      "abbreviation": "SCN",
      "created_at": "2026-01-09T23:07:36.000000Z",
      "updated_at": "2026-01-09T23:07:51.000000Z"
    },
    "judgment_date": null,
    "country": null,
    "citation": null,
    "judges": [],
    "judicial_precedent": null,
    "creator": {
      "id": 14,
      "name": "Camden Walter",
      "email": "admin_test@lawexa.com",
      "role": "admin",
      "is_creator": false,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "created_at": "2026-01-09T23:06:32.000000Z"
    },
    "created_at": "2026-01-09T23:08:50.000000Z",
    "updated_at": "2026-01-09T23:09:46.000000Z"
  }
}
```

**Not Found (case doesn't exist or not deleted):**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

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

Returned when a user lacks sufficient permissions.

```json
{
  "success": false,
  "message": "Insufficient permissions. This action requires at least admin role."
}
```

Or for case operations:

```json
{
  "success": false,
  "message": "Insufficient permissions. This action requires at least researcher role."
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

Returned when request validation fails.

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
| `id` | integer | Unique identifier |
| `name` | string | Country name |
| `code` | string | ISO country code (2-3 chars) |
| `abbreviation` | string | Country abbreviation |
| `slug` | string | URL-friendly identifier |
| `creator` | object | User who created the country |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### Court Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique identifier |
| `name` | string | Court name |
| `slug` | string | URL-friendly identifier |
| `abbreviation` | string | Court abbreviation |
| `country` | object | Associated country |
| `creator` | object | User who created the court |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### Judge Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique identifier |
| `name` | string | Judge's name |
| `slug` | string | URL-friendly identifier |
| `creator` | object | User who created the judge |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### Case Resource (List)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique identifier |
| `title` | string | Case title |
| `slug` | string | URL-friendly identifier |
| `excerpt` | string | Brief excerpt from body |
| `topic` | string\|null | Case topic |
| `tags` | array\|null | Case tags |
| `principles` | string\|null | Legal principles |
| `level` | string\|null | Difficulty level |
| `course` | object\|null | Associated course |
| `court` | object\|null | Court information |
| `country` | object\|null | Country information |
| `judgment_date` | date\|null | Date of judgment |
| `citation` | string\|null | Legal citation |
| `meta` | object | SEO metadata |

### Case Resource (Full)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique identifier |
| `title` | string | Case title |
| `slug` | string | URL-friendly identifier |
| `body` | string | Full case content |
| `course` | object\|null | Associated course |
| `topic` | string\|null | Case topic |
| `tags` | array\|null | Case tags |
| `principles` | string\|null | Legal principles |
| `level` | string\|null | Difficulty level |
| `court` | object\|null | Court information |
| `judgment_date` | date\|null | Date of judgment |
| `country` | object\|null | Country information |
| `citation` | string\|null | Legal citation |
| `judges` | array | Array of judge objects |
| `judicial_precedent` | string\|null | Judicial precedent |
| `creator` | object | User who created the case |
| `created_at` | datetime | ISO 8601 timestamp |
| `updated_at` | datetime | ISO 8601 timestamp |

### Creator Object (Nested User)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | User ID |
| `name` | string | User's name |
| `email` | string | User's email |
| `role` | string | User's role |
| `is_creator` | boolean | Creator status |
| `is_verified` | boolean | Email verification status |
| `auth_provider` | string | Authentication provider |
| `avatar_url` | string\|null | Avatar URL |
| `created_at` | datetime | ISO 8601 timestamp |

### Meta Object (SEO)

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | SEO title |
| `description` | string | SEO description |
| `canonical` | string | Canonical URL |

---

## Notes

### Endpoint Inconsistency

The Cases resource has different lookup methods for different operations:

| Operation | Lookup By |
|-----------|-----------|
| GET (show) | slug |
| PUT (update) | id |
| DELETE | id |
| POST restore | id |

### Role Hierarchy

| Role | Can Access |
|------|------------|
| Admin | All operations |
| Researcher | Case CRUD operations |
| User | Read-only operations |
| Guest | Read-only operations |

### Security

- SQL injection is prevented by Laravel's Eloquent ORM
- XSS content is escaped in JSON responses
- All write operations require authentication
- Role-based access control enforced on all endpoints
