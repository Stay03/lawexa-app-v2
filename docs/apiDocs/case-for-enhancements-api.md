# Case Form Enhancements - API Documentation

## Overview

This set of endpoints supports the Admin Add/Edit Case form by providing autocomplete suggestions for topics and tags, file attachment management for cases, and free-text academic level input. Topics and tags are sourced from existing values in the `court_cases` table — no separate lookup tables are used.

---

## Table of Contents

1. [Case Topics Autocomplete](#case-topics-autocomplete)
2. [Case Tags Autocomplete](#case-tags-autocomplete)
3. [Case File Management](#case-file-management)
4. [Level Field (Free Text)](#level-field-free-text)
5. [Error Responses](#error-responses)
6. [Data Models](#data-models)

---

## Case Topics Autocomplete

### Authentication

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/case-topics` | GET | Yes | Any |

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

**Response (With Search - `?search=Neg`):**
```json
{
  "success": true,
  "message": "Topics retrieved successfully.",
  "data": [
    "Negligence",
    "Negligence and Duty of Care",
    "Ngeligence"
  ]
}
```

**Response (No Matches - `?search=zzzznonexistent`):**
```json
{
  "success": true,
  "message": "Topics retrieved successfully.",
  "data": []
}
```

**Notes:**
- Returns a flat array of strings, not objects
- Results are distinct values from the `topic` column on `court_cases`
- Empty and null topics are excluded
- Maximum 20 results per request
- The frontend should allow users to either select a suggestion or type a new topic freely

---

## Case Tags Autocomplete

### Authentication

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/case-tags` | GET | Yes | Any |

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
- Returns a flat array of strings, not objects
- Results are collected from the JSON `tags` column across all cases, deduplicated
- Maximum 20 results per request
- The frontend should allow users to either select suggestions or type new tags freely
- Tags are submitted as an array of strings when creating/updating a case (e.g. `"tags": ["CONTRACT", "TORT"]`)

---

## Case File Management

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
    },
    {
      "id": 4,
      "url": "https://s3.amazonaws.com/bucket/case-files/2026/02/def456.docx",
      "original_name": "witness-statement.docx",
      "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "size": 524288,
      "created_at": "2026-02-09T10:30:00.000000Z"
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

**Request:**

`Content-Type: multipart/form-data`

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

**Response (Success - 201):**
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

**Response (Validation Error - No File):**
```json
{
  "success": false,
  "message": "Please select a file to upload.",
  "errors": {
    "file": [
      "Please select a file to upload."
    ]
  }
}
```

**Response (Validation Error - Invalid Type):**
```json
{
  "success": false,
  "message": "The file must be a PDF, DOC, DOCX, TXT, RTF, JPG, JPEG, PNG, GIF, or WebP.",
  "errors": {
    "file": [
      "The file must be a PDF, DOC, DOCX, TXT, RTF, JPG, JPEG, PNG, GIF, or WebP."
    ]
  }
}
```

**Response (Validation Error - File Too Large):**
```json
{
  "success": false,
  "message": "The file may not be larger than 20MB.",
  "errors": {
    "file": [
      "The file may not be larger than 20MB."
    ]
  }
}
```

**Response (Max Files Reached - 422):**
```json
{
  "success": false,
  "message": "Maximum of 10 files per case reached.",
  "errors": null
}
```

**Notes:**
- Laravel validates by actual file content MIME type, not just the file extension
- Files are stored on S3 in the `case-files/{year}/{month}/` directory
- The file `url` may be `null` if the S3 URL has not been generated yet
- Files also appear in the case detail response (`GET /api/cases/{slug}`) under the `files` key when the relationship is loaded

---

### Files in Case Detail Response

When fetching a single case via `GET /api/cases/{slug}`, the `files` array is included automatically:

```json
{
  "success": true,
  "message": "Case retrieved successfully.",
  "data": {
    "id": 8841,
    "title": "Example Case Title",
    "slug": "example-case-title",
    "files": [
      {
        "id": 5,
        "url": "https://...",
        "original_name": "case-report.pdf",
        "mime_type": "application/pdf",
        "size": 1048576,
        "created_at": "2026-02-10T13:04:00.000000Z"
      }
    ],
    "...": "other case fields"
  }
}
```

---

## Level Field (Free Text)

The `level` field on cases is a free-text string (max 50 characters). It is **not** restricted to an enum.

### Validation Rules

| Field | Rules | Description |
|-------|-------|-------------|
| `level` | `nullable`, `string`, `max:50` | Free text, e.g. "100L", "200L", "Beginner", "Advanced" |

**Usage in Create/Update Case:**
```json
{
  "title": "Case Title",
  "body": "Case body...",
  "level": "200L"
}
```

**Validation Error (Too Long):**
```json
{
  "success": false,
  "message": "Level cannot exceed 50 characters.",
  "errors": {
    "level": [
      "Level cannot exceed 50 characters."
    ]
  }
}
```

---

## Error Responses

### 401 Unauthenticated

Returned when no valid authentication token is provided.

```json
{
  "success": false,
  "message": "Unauthenticated.",
  "errors": null
}
```

### 403 Forbidden

Returned when the authenticated user lacks the required role (Researcher+) for file endpoints.

```json
{
  "success": false,
  "message": "Forbidden.",
  "errors": null
}
```

### 404 Not Found

Returned when the specified case does not exist.

```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

### 422 Validation Error

Returned when request validation fails. Structure varies by endpoint — see individual endpoint responses above.

---

## Data Models

### File Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | File ID |
| `url` | string\|null | Full URL to the file on S3 |
| `original_name` | string | Original file name as uploaded |
| `mime_type` | string | Detected MIME type of the file |
| `size` | integer | File size in bytes |
| `created_at` | datetime | ISO 8601 timestamp |

### Topic (Autocomplete Result)

Flat string array — no wrapping object.

```json
["Administrative Law", "Contract Law", "Negligence"]
```

### Tag (Autocomplete Result)

Flat string array — no wrapping object.

```json
["CONTRACT", "CRIMINAL LAW", "TORT"]
```

---

## Access Control Summary

| Action | Role Required |
|--------|---------------|
| Search case topics | Any authenticated user |
| Search case tags | Any authenticated user |
| List case files | Researcher+ |
| Upload case file | Researcher+ |
| Create/update case (with level) | Researcher+ |
