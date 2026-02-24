# Admin Lawyer Verification API

Endpoints for reviewing, approving, and rejecting lawyer verification submissions from the admin panel.

**Base URL:** `/api/admin/lawyer-verifications`
**Authentication:** Bearer token (Sanctum)
**Authorization:** `admin` role or higher

---

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats` | Verification counts by status |
| GET | `/` | List verifications, filterable by status (paginated) |
| GET | `/{id}` | Single lawyer profile with documents |
| POST | `/{id}/approve` | Approve a pending verification |
| POST | `/{id}/reject` | Reject a pending verification |

---

## 1. GET `/stats`

Returns total verification counts broken down by status. Use this for the admin dashboard overview.

### Response (200)

```json
{
  "success": true,
  "message": "Lawyer verification stats retrieved successfully.",
  "data": {
    "total": 8,
    "pending": 3,
    "approved": 3,
    "rejected": 2
  }
}
```

### Stats Fields

| Field | Description |
|-------|-------------|
| `total` | All lawyer profiles regardless of status |
| `pending` | Submitted and awaiting admin review (`verification_submitted_at` set, `is_verified` false, `verified_at` null) |
| `approved` | Verified profiles (`is_verified` true) |
| `rejected` | Rejected profiles (`rejection_reason` set, not re-submitted) |

> **Note:** Profiles that are neither submitted, approved, nor rejected (draft state) count only toward `total`.

---

## 2. GET `/`

List lawyer verification profiles, optionally filtered by status. Defaults to `pending`.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | `pending` (default), `approved`, `rejected`, or `all` |
| `per_page` | int | No | Items per page, 1–100 (default: 15) |
| `page` | int | No | Page number |

Invalid `status` values silently fall back to `pending`.

### Response (200)

```json
{
  "success": true,
  "message": "Pending verifications retrieved successfully.",
  "data": {
    "data": [
      {
        "id": 6,
        "user_id": 100,
        "user": {
          "id": 100,
          "name": "Ms. Helene Beer",
          "email": "sean.rodriguez@example.net",
          "avatar_url": null
        },
        "is_verified": false,
        "verified_at": null,
        "verification_submitted_at": "2026-02-24T03:35:01+00:00",
        "documents": [],
        "verifier": null,
        "created_at": "2026-02-24T03:35:05+00:00",
        "updated_at": "2026-02-24T03:35:05+00:00"
      }
    ],
    "current_page": 1,
    "per_page": 15,
    "total": 3,
    "last_page": 1
  }
}
```

### Message by Status

| `status` value | `message` |
|----------------|-----------|
| `pending` | `"Pending verifications retrieved successfully."` |
| `approved` | `"Approved verifications retrieved successfully."` |
| `rejected` | `"Rejected verifications retrieved successfully."` |
| `all` | `"All verifications retrieved successfully."` |

---

## 3. GET `/{id}`

Get a single lawyer profile by its ID, including the user, verification documents, and the admin who verified it.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | int | The `LawyerProfile` ID |

### Response (200)

```json
{
  "success": true,
  "message": "Lawyer profile retrieved successfully.",
  "data": {
    "id": 1,
    "user_id": 70,
    "user": {
      "id": 70,
      "name": "Test Lawyer",
      "email": "test@lawyer.com",
      "avatar_url": null
    },
    "is_verified": true,
    "verified_at": "2026-02-01T01:30:11+00:00",
    "verification_submitted_at": "2026-02-01T01:29:44+00:00",
    "verification_notes": "Verified successfully",
    "documents": [
      {
        "id": 2,
        "url": "https://bucket.s3.region.amazonaws.com/lawyer-verifications/70/uuid.pdf?X-Amz-...",
        "original_name": "bar-certificate.pdf",
        "mime_type": "application/pdf",
        "size": 204800,
        "created_at": "2026-02-01T01:29:38.000000Z"
      }
    ],
    "verifier": {
      "id": 71,
      "name": "Admin User",
      "email": "admin@lawexa.com",
      "avatar_url": null
    },
    "created_at": "2026-02-01T01:26:12+00:00",
    "updated_at": "2026-02-01T01:30:11+00:00"
  }
}
```

### Document URLs

Verification documents are stored as **private** files on S3. The `url` field in each document is a **temporary signed URL** that expires after **1 hour**. Re-fetch the profile to get a fresh URL.

### Conditional Fields

| Field | Shown when |
|-------|------------|
| `verification_notes` | Profile is approved (`is_verified: true`) |
| `rejection_reason` | Profile is rejected (`is_verified: false` and `rejection_reason` is set) |
| `verifier` | An admin has acted on the profile (approved or rejected) |

### Response (404)

```json
{
  "success": false,
  "message": "Lawyer profile not found.",
  "errors": null
}
```

---

## 4. POST `/{id}/approve`

Approve a submitted lawyer verification. The profile must have been submitted and not already verified.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | int | The `LawyerProfile` ID |

### Request Body

```json
{
  "verification_notes": "All documents verified and clear."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `verification_notes` | string | No | Optional admin note stored on the profile |

### Response (200)

```json
{
  "success": true,
  "message": "Lawyer verification approved successfully.",
  "data": {
    "id": 4,
    "user_id": 98,
    "user": {
      "id": 98,
      "name": "Ms. Helene Beer",
      "email": "sean.rodriguez@example.net",
      "avatar_url": null
    },
    "is_verified": true,
    "verified_at": "2026-02-24T03:39:56+00:00",
    "verification_submitted_at": "2026-02-24T03:35:01+00:00",
    "verification_notes": "All documents verified and clear.",
    "documents": [],
    "verifier": {
      "id": 42,
      "name": "Test Admin",
      "email": "admin@test.com",
      "avatar_url": null
    },
    "created_at": "2026-02-24T03:35:05+00:00",
    "updated_at": "2026-02-24T03:39:56+00:00"
  }
}
```

### Response (422) — Already verified

```json
{
  "success": false,
  "message": "This profile is already verified.",
  "errors": null
}
```

### Response (422) — Not submitted

```json
{
  "success": false,
  "message": "This profile has not been submitted for verification.",
  "errors": null
}
```

---

## 5. POST `/{id}/reject`

Reject a submitted lawyer verification. The rejection reason is required. Rejecting resets `verification_submitted_at` to `null`, allowing the lawyer to re-upload documents and resubmit.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | int | The `LawyerProfile` ID |

### Request Body

```json
{
  "rejection_reason": "Government-issued ID is expired."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rejection_reason` | string | **Yes** | Reason shown to the lawyer. Max 1000 characters. |

### Response (200)

```json
{
  "success": true,
  "message": "Lawyer verification rejected successfully.",
  "data": {
    "id": 5,
    "user_id": 99,
    "user": {
      "id": 99,
      "name": "Domenic Prosacco IV",
      "email": "kreiger.jazmin@example.org",
      "avatar_url": null
    },
    "is_verified": false,
    "verified_at": null,
    "verification_submitted_at": null,
    "rejection_reason": "Government-issued ID is expired.",
    "documents": [],
    "verifier": {
      "id": 42,
      "name": "Test Admin",
      "email": "admin@test.com",
      "avatar_url": null
    },
    "created_at": "2026-02-24T03:35:05+00:00",
    "updated_at": "2026-02-24T03:40:28+00:00"
  }
}
```

### Response (422) — Missing rejection reason

```json
{
  "success": false,
  "message": "A rejection reason is required.",
  "errors": {
    "rejection_reason": ["A rejection reason is required."]
  }
}
```

### Response (404)

```json
{
  "success": false,
  "message": "Lawyer profile not found.",
  "errors": null
}
```

---

## Verification Status Lifecycle

```
[Draft]
  └─ uploadDocuments() ──► [Has Documents]
       └─ submit()  ──────► [Pending]
            ├─ approve() ─► [Approved] (terminal)
            └─ reject()  ─► [Rejected]
                  └─ re-upload + submit() ──► [Pending]
```

| State | `is_verified` | `verification_submitted_at` | `verified_at` | `rejection_reason` |
|-------|:---:|:---:|:---:|:---:|
| Draft | `false` | `null` | `null` | `null` |
| Pending | `false` | set | `null` | `null` |
| Approved | `true` | set | set | `null` |
| Rejected | `false` | `null` (reset) | `null` | set |

---

## Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthenticated — missing or invalid Bearer token |
| 403 | Forbidden — user does not have `admin` role or higher |
| 404 | Lawyer profile not found |
| 422 | Business rule violation or validation error |

---

## Implementation Files

| File | Purpose |
|------|---------|
| `app/Http/Controllers/Admin/LawyerVerificationController.php` | Controller |
| `app/Services/LawyerVerificationService.php` | Business logic (stats, list, approve, reject) |
| `app/Models/LawyerProfile.php` | Model with `pendingVerification`, `verified` scopes |
| `app/Models/File.php` | Generates temporary signed S3 URLs for private docs |
| `app/Http/Resources/LawyerProfileResource.php` | API resource transformer |
| `app/Http/Requests/Admin/ApproveVerificationRequest.php` | Approve form request |
| `app/Http/Requests/Admin/RejectVerificationRequest.php` | Reject form request (requires `rejection_reason`) |
| `routes/api.php` | Route definitions |
| `tests/Feature/Admin/LawyerVerificationControllerTest.php` | Feature tests (32 tests) |
| `tests/Unit/LawyerVerificationServiceTest.php` | Unit tests (11 tests) |
