# Phase 16: Lawyer Verification & File Management - API Documentation

## Overview

Phase 16 implements a comprehensive lawyer verification system and enhanced file management capabilities. The system allows users to create lawyer profiles, upload verification documents, and submit for admin approval. Additionally, it provides centralized file management endpoints for all users.

**Key Features:**
- Lawyer profile creation and management
- Document upload for verification (PDF, JPG, JPEG, PNG)
- Admin verification workflow (approve/reject)
- Enhanced file management (list, view, download, delete)
- Automated orphan file cleanup
- Events dispatched for verification lifecycle

---

## Table of Contents

1. [Lawyer Verification (User)](#lawyer-verification-user)
2. [Lawyer Verification (Admin)](#lawyer-verification-admin)
3. [File Management](#file-management)
4. [Error Responses](#error-responses)
5. [Data Models](#data-models)

---

## Lawyer Verification (User)

### Authentication

All endpoints require `auth:sanctum` middleware and email verification.

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/lawyer-verification/my-profile` | GET | Yes | Get own lawyer profile |
| `/api/lawyer-verification/profile` | POST | Yes | Create lawyer profile |
| `/api/lawyer-verification/documents` | POST | Yes | Upload verification document |
| `/api/lawyer-verification/documents/{file}` | DELETE | Yes | Delete verification document |
| `/api/lawyer-verification/submit` | POST | Yes | Submit profile for verification |

---

### GET /api/lawyer-verification/my-profile

Retrieve the authenticated user's lawyer profile with all verification documents.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Lawyer profile retrieved successfully.",
  "data": {
    "id": 1,
    "user_id": 70,
    "is_verified": false,
    "verified_at": null,
    "verification_submitted_at": null,
    "documents": [],
    "created_at": "2026-02-01T01:26:12+00:00",
    "updated_at": "2026-02-01T01:26:12+00:00"
  }
}
```

**Response (404 Not Found) - No profile:**
```json
{
  "success": false,
  "message": "No lawyer profile found. Create one first.",
  "errors": null
}
```

---

### POST /api/lawyer-verification/profile

Create a new lawyer profile for the authenticated user. Users can only have one profile.

**Authorization:** User must not already have a lawyer profile.

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Lawyer profile created successfully.",
  "data": {
    "id": 2,
    "user_id": 72,
    "is_verified": null,
    "verified_at": null,
    "verification_submitted_at": null,
    "created_at": "2026-02-01T01:30:24+00:00",
    "updated_at": "2026-02-01T01:30:24+00:00"
  }
}
```

**Error Response (403 Forbidden) - Already has profile:**
```json
{
  "success": false,
  "message": "This action is unauthorized.",
  "errors": null
}
```

---

### POST /api/lawyer-verification/documents

Upload a verification document (e.g., bar license, certificate).

**Authorization:** User must own the profile and it must not be submitted yet.

**Request Body (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | file | Yes | PDF, JPG, JPEG, or PNG (max 10MB) |

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/lawyer-verification/documents" \
  -H "Authorization: Bearer {token}" \
  -F "file=@/path/to/document.pdf"
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Document uploaded successfully.",
  "data": {
    "id": 2,
    "url": "/storage/lawyer-verifications/70/652800c9-98df-4b5b-b785-f26291c5bd51.png",
    "original_name": "bar-license.png",
    "mime_type": "image/png",
    "size": 245678,
    "created_at": "2026-02-01T01:29:38.000000Z"
  }
}
```

**Error Response (422 Unprocessable Entity) - Invalid file type:**
```json
{
  "success": false,
  "message": "The file must be a PDF, JPG, JPEG, or PNG.",
  "errors": {
    "file": [
      "The file must be a PDF, JPG, JPEG, or PNG."
    ]
  }
}
```

**Error Response (422 Unprocessable Entity) - File too large:**
```json
{
  "success": false,
  "message": "The file size must not exceed 10 MB.",
  "errors": {
    "file": [
      "The file size must not exceed 10 MB."
    ]
  }
}
```

---

### DELETE /api/lawyer-verification/documents/{file}

Delete a verification document. Only allowed before profile submission.

**Authorization:** User must own the file and profile must not be submitted.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": "Document deleted successfully."
}
```

**Error Response (403 Forbidden) - Already submitted:**
```json
{
  "success": false,
  "message": "This action is unauthorized.",
  "errors": null
}
```

---

### POST /api/lawyer-verification/submit

Submit the lawyer profile for admin verification. Requires at least one uploaded document.

**Authorization:** User must own the profile, have documents, and not already be submitted.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile submitted for verification successfully.",
  "data": {
    "id": 1,
    "user_id": 70,
    "is_verified": false,
    "verified_at": null,
    "verification_submitted_at": "2026-02-01T01:29:44+00:00",
    "documents": [
      {
        "id": 2,
        "url": "/storage/lawyer-verifications/70/652800c9-98df-4b5b-b785-f26291c5bd51.png",
        "original_name": "bar-license.png",
        "mime_type": "image/png",
        "size": 245678,
        "created_at": "2026-02-01T01:29:38.000000Z"
      }
    ],
    "created_at": "2026-02-01T01:26:12+00:00",
    "updated_at": "2026-02-01T01:29:44+00:00"
  }
}
```

**Error Response (422 Unprocessable Entity) - No documents:**
```json
{
  "success": false,
  "message": "Cannot submit profile without verification documents.",
  "errors": null
}
```

**Error Response (422 Unprocessable Entity) - Already submitted:**
```json
{
  "success": false,
  "message": "Profile has already been submitted for verification.",
  "errors": null
}
```

---

## Lawyer Verification (Admin)

### Authentication

All admin endpoints require `auth:sanctum` middleware and admin role.

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/admin/lawyer-verifications` | GET | Yes | Admin |
| `/api/admin/lawyer-verifications/{id}` | GET | Yes | Admin |
| `/api/admin/lawyer-verifications/{id}/approve` | POST | Yes | Admin |
| `/api/admin/lawyer-verifications/{id}/reject` | POST | Yes | Admin |

---

### GET /api/admin/lawyer-verifications

List all pending lawyer verification submissions.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Pending verifications retrieved successfully.",
  "data": {
    "data": [
      {
        "id": 1,
        "user_id": 70,
        "is_verified": false,
        "verified_at": null,
        "verification_submitted_at": "2026-02-01T01:29:44+00:00",
        "documents": [
          {
            "id": 2,
            "url": "/storage/lawyer-verifications/70/652800c9-98df-4b5b-b785-f26291c5bd51.png",
            "original_name": "bar-license.png",
            "mime_type": "image/png",
            "size": 245678,
            "created_at": "2026-02-01T01:29:38.000000Z"
          }
        ],
        "created_at": "2026-02-01T01:26:12+00:00",
        "updated_at": "2026-02-01T01:29:44+00:00"
      }
    ],
    "current_page": 1,
    "per_page": 15,
    "total": 1,
    "last_page": 1
  }
}
```

**Error Response (403 Forbidden) - Not admin:**
```json
{
  "success": false,
  "message": "This action is unauthorized.",
  "errors": null
}
```

---

### GET /api/admin/lawyer-verifications/{id}

View detailed information about a specific lawyer verification request.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Lawyer profile retrieved successfully.",
  "data": {
    "id": 1,
    "user_id": 70,
    "is_verified": false,
    "verified_at": null,
    "verification_submitted_at": "2026-02-01T01:29:44+00:00",
    "documents": [
      {
        "id": 2,
        "url": "/storage/lawyer-verifications/70/652800c9-98df-4b5b-b785-f26291c5bd51.png",
        "original_name": "bar-license.png",
        "mime_type": "image/png",
        "size": 245678,
        "created_at": "2026-02-01T01:29:38.000000Z"
      }
    ],
    "user": {
      "id": 70,
      "name": "Test Lawyer",
      "email": "test@lawyer.com",
      "role": "user",
      "is_creator": null,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "created_at": "2026-02-01T01:25:00.000000Z"
    },
    "created_at": "2026-02-01T01:26:12+00:00",
    "updated_at": "2026-02-01T01:29:44+00:00"
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "message": "Lawyer profile not found.",
  "errors": null
}
```

---

### POST /api/admin/lawyer-verifications/{id}/approve

Approve a lawyer verification request.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| verification_notes | string | No | Optional notes (max 1000 chars) |

**Example Request:**
```json
{
  "verification_notes": "Verified successfully. All documents are valid."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Lawyer verification approved successfully.",
  "data": {
    "id": 1,
    "user_id": 70,
    "is_verified": true,
    "verified_at": "2026-02-01T01:30:11+00:00",
    "verification_submitted_at": "2026-02-01T01:29:44+00:00",
    "verification_notes": "Verified successfully. All documents are valid.",
    "documents": [
      {
        "id": 2,
        "url": "/storage/lawyer-verifications/70/652800c9-98df-4b5b-b785-f26291c5bd51.png",
        "original_name": "bar-license.png",
        "mime_type": "image/png",
        "size": 245678,
        "created_at": "2026-02-01T01:29:38.000000Z"
      }
    ],
    "verifier": {
      "id": 71,
      "name": "Admin User",
      "email": "admin@lawyer.com",
      "avatar_url": null
    },
    "created_at": "2026-02-01T01:26:12+00:00",
    "updated_at": "2026-02-01T01:30:11+00:00"
  }
}
```

**Error Response (422 Unprocessable Entity) - Already verified:**
```json
{
  "success": false,
  "message": "Profile is already verified.",
  "errors": null
}
```

**Error Response (422 Unprocessable Entity) - Not submitted:**
```json
{
  "success": false,
  "message": "Profile has not been submitted for verification yet.",
  "errors": null
}
```

---

### POST /api/admin/lawyer-verifications/{id}/reject

Reject a lawyer verification request. User can resubmit after fixing issues.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| rejection_reason | string | Yes | Reason for rejection (max 1000 chars) |

**Example Request:**
```json
{
  "rejection_reason": "Documents are not clear enough. Please upload higher quality scans."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Lawyer verification rejected successfully.",
  "data": {
    "id": 2,
    "user_id": 72,
    "is_verified": false,
    "verified_at": null,
    "verification_submitted_at": null,
    "rejection_reason": "Documents are not clear enough. Please upload higher quality scans.",
    "documents": [
      {
        "id": 3,
        "url": "/storage/lawyer-verifications/72/66ae0639-edbf-42d1-8e8f-948765dfba60.png",
        "original_name": "license.png",
        "mime_type": "image/png",
        "size": 198450,
        "created_at": "2026-02-01T01:30:29.000000Z"
      }
    ],
    "verifier": {
      "id": 71,
      "name": "Admin User",
      "email": "admin@lawyer.com",
      "avatar_url": null
    },
    "created_at": "2026-02-01T01:30:24+00:00",
    "updated_at": "2026-02-01T01:30:43+00:00"
  }
}
```

**Error Response (422 Unprocessable Entity) - Missing reason:**
```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": {
    "rejection_reason": [
      "The rejection reason field is required."
    ]
  }
}
```

---

## File Management

### Authentication

All endpoints require `auth:sanctum` middleware.

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/files` | GET | Yes | List user's uploaded files |
| `/api/files/{file}` | GET | Yes | View file details |
| `/api/files/{file}` | DELETE | Yes | Delete file |
| `/api/files/{file}/download` | GET | Yes | Download file |

---

### GET /api/files

List all files uploaded by the authenticated user.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category` | string | - | Filter by file category |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Available Categories:**
- `lawyer_verification` - Lawyer verification documents
- `avatar` - User profile avatars
- `thumbnail` - Note thumbnails
- `content_image` - Note content images
- `logo` - Firm logos
- `cac_document` - Firm CAC documents

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Files retrieved successfully.",
  "data": {
    "data": [
      {
        "id": 3,
        "url": "/storage/lawyer-verifications/72/66ae0639-edbf-42d1-8e8f-948765dfba60.png",
        "original_name": "license.png",
        "mime_type": "image/png",
        "size": 198450,
        "created_at": "2026-02-01T01:30:29.000000Z"
      }
    ],
    "current_page": 1,
    "per_page": 15,
    "total": 1,
    "last_page": 1
  }
}
```

**Example Request with category filter:**
```bash
curl -X GET "http://localhost:8000/api/files?category=lawyer_verification" \
  -H "Authorization: Bearer {token}"
```

---

### GET /api/files/{file}

View detailed information about a specific file.

**Authorization:** User must own the file or be an admin.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "File retrieved successfully.",
  "data": {
    "id": 3,
    "url": "/storage/lawyer-verifications/72/66ae0639-edbf-42d1-8e8f-948765dfba60.png",
    "original_name": "license.png",
    "mime_type": "image/png",
    "size": 198450,
    "created_at": "2026-02-01T01:30:29.000000Z"
  }
}
```

**Error Response (403 Forbidden) - Not authorized:**
```json
{
  "success": false,
  "message": "This action is unauthorized.",
  "errors": null
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "message": "File not found.",
  "errors": null
}
```

---

### DELETE /api/files/{file}

Delete a file from storage and database.

**Authorization:** User must own the file or be an admin.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "File deleted successfully.",
  "data": null
}
```

**Error Response (403 Forbidden) - Not authorized:**
```json
{
  "success": false,
  "message": "This action is unauthorized.",
  "errors": null
}
```

---

### GET /api/files/{file}/download

Download a file or get a download URL.

**Authorization:** User must own the file or be an admin.

**Behavior:**
- **Private files** (disk='local'): Returns file as download with proper headers
- **Public files** (disk='public'): Returns JSON with public URL

**Response for Private Files (200 OK):**
```
Content-Type: image/png
Content-Length: 198450
Content-Disposition: attachment; filename=license.png

[Binary file data]
```

**Response for Public Files (200 OK):**
```json
{
  "success": true,
  "message": "File URL generated.",
  "data": {
    "url": "http://localhost:8000/storage/avatars/abc123.jpg"
  }
}
```

**Error Response (404 Not Found) - File deleted from storage:**
```json
{
  "success": false,
  "message": "File not found on storage.",
  "errors": null
}
```

---

## Error Responses

### Common HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created successfully |
| 400 | Bad request |
| 401 | Unauthenticated |
| 403 | Forbidden - Unauthorized action |
| 404 | Resource not found |
| 422 | Validation error |
| 500 | Server error |

### Standard Error Format

All error responses follow this structure:

```json
{
  "success": false,
  "message": "Error description",
  "errors": {
    "field": ["Validation error message"]
  }
}
```

---

## Data Models

### LawyerProfile

| Field | Type | Description |
|-------|------|-------------|
| id | integer | Unique identifier |
| user_id | integer | Associated user ID |
| is_verified | boolean | Verification status |
| verified_at | datetime\|null | When profile was verified |
| verified_by | integer\|null | Admin user who verified |
| verification_submitted_at | datetime\|null | When submitted for review |
| verification_notes | string\|null | Admin notes (only when verified) |
| rejection_reason | string\|null | Rejection reason (only when rejected) |
| documents | array | Array of File objects |
| user | object | User object (when loaded) |
| verifier | object | Admin user object (when loaded) |
| created_at | datetime | Creation timestamp |
| updated_at | datetime | Last update timestamp |

### File

| Field | Type | Description |
|-------|------|-------------|
| id | integer | Unique identifier |
| url | string | File access URL |
| original_name | string | Original filename |
| mime_type | string | File MIME type |
| size | integer | File size in bytes |
| category | string | File category |
| upload_status | string | completed, pending, or failed |
| created_at | datetime | Upload timestamp |

### User Summary (in verifier field)

| Field | Type | Description |
|-------|------|-------------|
| id | integer | User ID |
| name | string | User name |
| email | string | User email |
| avatar_url | string\|null | Avatar URL |

---

## Events

The following events are dispatched during the lawyer verification lifecycle:

### LawyerVerificationSubmitted

**Dispatched:** When user submits profile for verification

**Payload:**
- `profile` - LawyerProfile model
- `user` - User model

### LawyerVerificationApproved

**Dispatched:** When admin approves verification

**Payload:**
- `profile` - LawyerProfile model
- `approvedBy` - Admin User model

### LawyerVerificationRejected

**Dispatched:** When admin rejects verification

**Payload:**
- `profile` - LawyerProfile model
- `rejectedBy` - Admin User model
- `reason` - Rejection reason string

---

## Scheduled Jobs

### CleanOrphanFiles

**Schedule:** Daily (configured in `routes/console.php`)

**Purpose:** Automatically clean up orphaned files:
- Failed uploads (24 hours old)
- Pending uploads (48 hours old)
- True orphans with no owner (7 days old)

**Logs:** Records deletion count in application logs

---

## Notes

1. **File Storage:** Lawyer verification documents are stored in `storage/app/lawyer-verifications/{user_id}/`
2. **Max File Size:** 10MB for verification documents
3. **Allowed MIME Types:** application/pdf, image/jpeg, image/jpg, image/png
4. **Resubmission:** After rejection, users can upload new documents and resubmit
5. **Authorization:** All endpoints use Laravel policies for fine-grained access control
6. **UUID Filenames:** All uploaded files use UUID-based filenames to prevent conflicts
7. **Cascade Deletion:** When a user is deleted, their lawyer profile and documents are automatically removed
