# Onboarding API - Frontend Reference

## Overview

The onboarding API enables the frontend to persist each onboarding step immediately to the server rather than relying on localStorage. This provides cross-device progress recovery, drop-off analytics, and automatic cleanup of orphaned verification documents.

**Key Features:**
- Step-by-step persistence — each step is saved independently as the user progresses
- Resume from any device — `GET /progress` hydrates the frontend store on load
- Flexible completion — frontend can either save step-by-step then trigger completion, or submit everything in a single `POST /complete` request
- `step` is a bookmark (last completed step number), not a sequential gate — steps can arrive out of order or be skipped
- Per-`user_type` validation enforced only at completion, not during step saving
- 409 Conflict returned on any mutating request after onboarding is already completed

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Endpoints](#endpoints)
   - [GET /api/onboarding/progress](#get-apionboardingprogress)
   - [PUT /api/onboarding/step](#put-apionboardingstep)
   - [POST /api/onboarding/complete](#post-apionboardingcomplete)
3. [Completion Validation Rules](#completion-validation-rules)
4. [Field Mapping: region ↔ state](#field-mapping-region--state)
5. [User Type Reference](#user-type-reference)
6. [Validation & Error Responses](#validation--error-responses)
7. [Data Models](#data-models)
8. [Implementation Notes](#implementation-notes)
9. [Examples](#examples)

---

## Authentication & Authorization

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/onboarding/progress` | GET | Yes | Any |
| `/api/onboarding/step` | PUT | Yes | Any |
| `/api/onboarding/complete` | POST | Yes | Any |

**Unauthenticated (401):**

```json
{
  "success": false,
  "message": "Unauthenticated.",
  "errors": null
}
```

**Already Completed (409):**

```json
{
  "success": false,
  "message": "Onboarding already completed.",
  "errors": null
}
```

---

## Endpoints

### GET /api/onboarding/progress

Retrieve the authenticated user's saved onboarding state as a flat structure for frontend store hydration. Returns all fields as `null` if the user has no profile yet.

**Example Request:**

```bash
curl -X GET "http://localhost:8000/api/onboarding/progress" \
  -H "Authorization: Bearer {token}"
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Onboarding progress retrieved successfully.",
  "data": {
    "user_type": "lawyer",
    "onboarding_step": 3,
    "is_completed": false,
    "communication_style": "co_worker",
    "country": "Nigeria",
    "country_code": "NG",
    "region": "Lagos",
    "city": "Lagos",
    "profession": null,
    "university": null,
    "level": null,
    "law_school": null,
    "area_of_study": null,
    "call_to_bar_year": null,
    "bio": null,
    "call_number": null,
    "areas_of_expertise": [
      { "id": 1, "name": "Criminal Law", "slug": "criminal-law" }
    ]
  }
}
```

**Response — No Profile Yet (200):**

```json
{
  "success": true,
  "message": "Onboarding progress retrieved successfully.",
  "data": {
    "user_type": null,
    "onboarding_step": null,
    "is_completed": false,
    "communication_style": null,
    "country": null,
    "country_code": null,
    "region": null,
    "city": null,
    "profession": null,
    "university": null,
    "level": null,
    "law_school": null,
    "area_of_study": null,
    "call_to_bar_year": null,
    "bio": null,
    "call_number": null,
    "areas_of_expertise": []
  }
}
```

**Notes:**
- The `region` field is read from the `state` column in the database — the API transparently maps these for you
- `is_completed: true` when onboarding has been finished; subsequent mutating requests will return 409
- Safe to call on every app load to restore store state

---

### PUT /api/onboarding/step

Save fields for any onboarding step. Creates the user's profile on first call. The `step` value is a bookmark (the last step the user completed) — the backend does not enforce step ordering.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `step` | integer | Yes | Step number (1–10). Stored as the last completed step bookmark. |
| `user_type` | string | No | One of: `lawyer`, `law_student`, `other` |
| `communication_style` | string | No | One of: `co_worker`, `study_guide`, `assistant` |
| `country` | string | No | Country name (max 100) |
| `country_code` | string | No | ISO country code, e.g. `NG` (max 10) |
| `region` | string | No | Region/state name — stored as `state` internally (max 255) |
| `city` | string | No | City name (max 255) |
| `profession` | string | No | User's profession (max 255) |
| `area_of_study` | string | No | Area of study (max 200) |
| `university` | string | No | University name (max 255) |
| `level` | string | No | Academic level, e.g. `300` or `Graduate` (max 100) |
| `law_school` | string | No | Law school name (max 255) |
| `call_to_bar_year` | integer | No | Year called to bar (1900–current year) |
| `call_number` | string | No | Bar call number (max 50) |
| `bio` | string | No | User biography (max 2000) |
| `areas_of_expertise` | array | No | Array of `AreaOfExpertise` IDs to sync |
| `areas_of_expertise.*` | integer | No | Must exist in `areas_of_expertise` table |

**Example Requests:**

```bash
# Step 1 — set user type
curl -X PUT "http://localhost:8000/api/onboarding/step" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"step": 1, "user_type": "lawyer"}'

# Step 2 — communication style
curl -X PUT "http://localhost:8000/api/onboarding/step" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"step": 2, "communication_style": "co_worker"}'

# Step 3 — location (note: send "region", not "state")
curl -X PUT "http://localhost:8000/api/onboarding/step" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"step": 3, "country": "Nigeria", "country_code": "NG", "region": "Lagos", "city": "Lagos"}'

# Step 7 — areas of expertise (replaces existing selection)
curl -X PUT "http://localhost:8000/api/onboarding/step" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"step": 7, "areas_of_expertise": [1, 3, 5]}'
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Onboarding step saved successfully.",
  "data": {
    "profile": {
      "id": 17,
      "user_type": "lawyer",
      "onboarding_step": 3,
      "communication_style": "co_worker",
      "country": "Nigeria",
      "country_code": "NG",
      "city": "Lagos",
      "state": "Lagos",
      "profession": null,
      "university": null,
      "level": null,
      "law_school": null,
      "area_of_study": null,
      "call_to_bar_year": null,
      "call_number": null,
      "bio": null,
      "gender": null,
      "date_of_birth": null,
      "address": null,
      "other_certifications": null,
      "work_experience": null,
      "linkedin_url": null,
      "website_url": null,
      "twitter_url": null,
      "facebook_url": null,
      "onboarding_completed_at": null
    },
    "areas_of_expertise": [
      { "id": 1, "name": "Criminal Law", "slug": "criminal-law" }
    ]
  }
}
```

**Error — Already Completed (409):**

```json
{
  "success": false,
  "message": "Onboarding already completed.",
  "errors": null
}
```

**Error — Missing Step (422):**

```json
{
  "success": false,
  "message": "Step number is required.",
  "errors": {
    "step": ["Step number is required."]
  }
}
```

**Notes:**
- `areas_of_expertise` is **synced** (replaces all previous selections) — send the full desired set each time
- The profile is created automatically on the first call if it doesn't exist
- `step` values outside 1–10 are rejected
- All non-`step` fields are optional — send only what changed

---

### POST /api/onboarding/complete

Validate the user's saved onboarding data per their `user_type` and mark onboarding as complete. Returns the full `user + location` object (same shape as `GET /auth/me`).

Supports two usage modes:
- **Step-by-step mode:** Call with an empty body after finishing all `PUT /step` calls
- **Single-request mode:** Send the full payload; the server saves the data then validates and completes in one shot

**Request Body:**

All fields are optional. Same fields as `PUT /api/onboarding/step` minus `step`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_type` | string | No | One of: `lawyer`, `law_student`, `other` |
| `communication_style` | string | No | One of: `co_worker`, `study_guide`, `assistant` |
| `country` | string | No | Country name |
| `country_code` | string | No | ISO country code |
| `region` | string | No | Region/state name |
| `city` | string | No | City name |
| `profession` | string | No | User's profession |
| `university` | string | No | University name |
| `level` | string | No | Academic level |
| `law_school` | string | No | Law school name |
| `area_of_study` | string | No | Area of study |
| `call_to_bar_year` | integer | No | Year called to bar |
| `call_number` | string | No | Bar call number |
| `bio` | string | No | Biography |
| `areas_of_expertise` | array | No | Array of expertise IDs |

**Example Requests:**

```bash
# Mode 1: trigger completion (data already saved via PUT /step)
curl -X POST "http://localhost:8000/api/onboarding/complete" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{}'

# Mode 2: full payload — save and complete in one request
curl -X POST "http://localhost:8000/api/onboarding/complete" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_type": "other",
    "communication_style": "study_guide",
    "country": "Ghana",
    "country_code": "GH",
    "region": "Greater Accra",
    "city": "Accra",
    "profession": "journalist"
  }'
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Onboarding completed successfully.",
  "data": {
    "user": {
      "id": 88,
      "uuid": "8fd6e3f1-eaa9-46a9-a49d-442bbad0959d",
      "name": "Test User",
      "email": "test@example.com",
      "role": "user",
      "is_creator": false,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "profile": {
        "id": 17,
        "user_type": "lawyer",
        "onboarding_step": 7,
        "onboarding_completed_at": "2026-02-21T00:32:14.000000Z",
        "communication_style": "co_worker",
        "country": "Nigeria",
        "country_code": "NG",
        "city": "Lagos",
        "state": "Lagos",
        "profession": "lawyer",
        "university": null,
        "level": null,
        "law_school": null,
        "area_of_study": null,
        "call_to_bar_year": null,
        "call_number": null,
        "bio": null,
        "gender": null,
        "date_of_birth": null,
        "address": null,
        "other_certifications": null,
        "work_experience": null,
        "linkedin_url": null,
        "website_url": null,
        "twitter_url": null,
        "facebook_url": null
      },
      "areas_of_expertise": [
        { "id": 1, "name": "Criminal Law", "slug": "criminal-law" }
      ],
      "created_at": "2026-02-21T00:29:25.000000Z"
    },
    "location": {
      "country": "Nigeria",
      "country_code": "NG",
      "continent": "Africa",
      "region": "Lagos",
      "city": "Lagos"
    }
  }
}
```

**Error — Already Completed (409):**

```json
{
  "success": false,
  "message": "Onboarding already completed.",
  "errors": null
}
```

**Error — No Profile Exists (422):**

```json
{
  "success": false,
  "message": "No onboarding data found. Please complete onboarding steps first.",
  "errors": {
    "user_type": ["No onboarding data found. Please complete onboarding steps first."]
  }
}
```

**Error — Missing Required Fields (422):**

```json
{
  "success": false,
  "message": "At least one area of expertise is required. (and 1 more error)",
  "errors": {
    "areas_of_expertise": ["At least one area of expertise is required."],
    "communication_style": ["Communication style is required to complete onboarding."]
  }
}
```

**Notes:**
- `profession` is auto-derived: `lawyer` → `"lawyer"`, `law_student` → `"student"` (only if not already set)
- `area_of_study` is auto-set to `"Law"` for `law_student` type (only if not already set)
- The response `location` is geo-detected from the request IP address
- After success, the `profile.onboarding_completed_at` timestamp is set and subsequent `PUT /step` and `POST /complete` calls return 409

---

## Completion Validation Rules

Validation is only enforced at `POST /complete`, not during `PUT /step`. All types require `communication_style` and `country`.

| Field | `lawyer` | `law_student` | `other` (non-student) | `other` (student*) |
|-------|----------|---------------|----------------------|---------------------|
| `communication_style` | Required | Required | Required | Required |
| `country` | Required | Required | Required | Required |
| `profession` | Auto → `"lawyer"` | Auto → `"student"` | Required | `"student"` |
| `university` OR `law_school` | — | Required | — | Required (`university`) |
| `level` | — | Required (if `university` set) | — | Required |
| `area_of_study` | — | Auto → `"Law"` | — | Required |
| `areas_of_expertise` (min 1) | Required | Required | — | — |

*"other student" is determined by `profession === "student"`

---

## Field Mapping: region ↔ state

The database stores geographic region in the `state` column. The API abstracts this so the frontend always works with `region`:

| Direction | Frontend Field | Database Column |
|-----------|---------------|-----------------|
| Write (PUT/POST) | `region` | `state` |
| Read (GET progress) | `region` | `state` |
| Read (profile resource) | `state` | `state` |

**Practical rules:**
- Always send `region` to both `PUT /step` and `POST /complete`, never `state`
- `GET /progress` returns `region` (already mapped)
- The `UserProfileResource` (returned in `PUT /step` response and `POST /complete` response) exposes `state` directly — use `region` from the `GET /progress` response for store hydration

---

## User Type Reference

| Value | Description |
|-------|-------------|
| `lawyer` | Practicing lawyer, barrister, or solicitor |
| `law_student` | Law school or university student studying law |
| `other` | Any other user (journalist, academic, general public, etc.) |

---

## Validation & Error Responses

### Missing Step (422)

```json
{
  "success": false,
  "message": "Step number is required.",
  "errors": {
    "step": ["Step number is required."]
  }
}
```

### Step Out of Range (422)

```json
{
  "success": false,
  "message": "Step number must be at least 1.",
  "errors": {
    "step": ["Step number must be at least 1."]
  }
}
```

### Invalid user_type (422)

```json
{
  "success": false,
  "message": "User type must be one of: lawyer, law_student, other.",
  "errors": {
    "user_type": ["User type must be one of: lawyer, law_student, other."]
  }
}
```

### Invalid communication_style (422)

```json
{
  "success": false,
  "message": "Communication style must be one of: co_worker, study_guide, assistant.",
  "errors": {
    "communication_style": ["Communication style must be one of: co_worker, study_guide, assistant."]
  }
}
```

### Invalid Area of Expertise ID (422)

```json
{
  "success": false,
  "message": "One or more areas of expertise do not exist.",
  "errors": {
    "areas_of_expertise.0": ["One or more areas of expertise do not exist."]
  }
}
```

### Missing Required Fields at Completion (422)

```json
{
  "success": false,
  "message": "University or law school is required for law students. (and 1 more error)",
  "errors": {
    "university": ["University or law school is required for law students."],
    "areas_of_expertise": ["At least one area of expertise is required."]
  }
}
```

### Onboarding Already Completed (409)

```json
{
  "success": false,
  "message": "Onboarding already completed.",
  "errors": null
}
```

---

## Data Models

### Progress Response

| Field | Type | Description |
|-------|------|-------------|
| `user_type` | string\|null | `lawyer`, `law_student`, or `other` |
| `onboarding_step` | integer\|null | Last step number saved (bookmark) |
| `is_completed` | boolean | Whether onboarding has been completed |
| `communication_style` | string\|null | `co_worker`, `study_guide`, or `assistant` |
| `country` | string\|null | Country name |
| `country_code` | string\|null | ISO country code (e.g. `NG`) |
| `region` | string\|null | Region/state name |
| `city` | string\|null | City name |
| `profession` | string\|null | User's profession |
| `university` | string\|null | University name |
| `level` | string\|null | Academic level |
| `law_school` | string\|null | Law school name |
| `area_of_study` | string\|null | Area of study |
| `call_to_bar_year` | integer\|null | Year called to bar |
| `bio` | string\|null | Biography |
| `call_number` | string\|null | Bar call number |
| `areas_of_expertise` | array | Array of `{ id, name, slug }` objects |

---

### UserProfile Resource (returned by PUT /step)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Profile ID |
| `user_type` | string\|null | `lawyer`, `law_student`, or `other` |
| `onboarding_step` | integer\|null | Last completed step bookmark |
| `onboarding_completed_at` | datetime\|null | ISO 8601 completion timestamp |
| `communication_style` | string\|null | Enum value |
| `country` | string\|null | Country name |
| `country_code` | string\|null | ISO country code |
| `city` | string\|null | City |
| `state` | string\|null | Region/state (see field mapping note above) |
| `profession` | string\|null | Profession |
| `university` | string\|null | University |
| `level` | string\|null | Academic level |
| `law_school` | string\|null | Law school |
| `area_of_study` | string\|null | Area of study |
| `call_to_bar_year` | integer\|null | Year called to bar |
| `call_number` | string\|null | Bar call number |
| `bio` | string\|null | Biography |
| `gender` | string\|null | `male`, `female`, or `other` |
| `date_of_birth` | date\|null | Format: `YYYY-MM-DD` |

---

### Completion Response

The `POST /complete` response wraps the full `GET /auth/me` payload:

| Field | Type | Description |
|-------|------|-------------|
| `user` | object | Full `UserResource` (id, uuid, name, email, role, profile, areas_of_expertise, etc.) |
| `location` | object | Geo-detected from request IP: `{ country, country_code, continent, region, city }` |

---

## Implementation Notes

### Step as Bookmark

The `onboarding_step` value is a bookmark, not a gate. The backend saves whatever step number is sent without checking whether previous steps were completed. This allows:
- Conditional steps that are skipped based on earlier answers
- Non-linear flows (e.g., user goes back and re-does step 2)
- Partial submissions where only the bookmark is updated

### areas_of_expertise Sync

`areas_of_expertise` is a **replace-all sync** — each `PUT /step` with this field entirely replaces the user's previous expertise selections. Send the complete desired set every time, not incremental additions.

### Profession Auto-Derivation

`POST /complete` automatically fills `profession` if not already set:
- `user_type: "lawyer"` → `profession = "lawyer"`
- `user_type: "law_student"` → `profession = "student"`, `area_of_study = "Law"` (both auto-set if empty)

This auto-derivation runs **before** validation and **before** any data is returned. If the completion fails validation, the auto-derived values are still persisted.

### user_type Change Mid-Flow

If a user changes `user_type` mid-flow (e.g., from `lawyer` to `law_student`), previously saved fields that don't apply to the new type are simply ignored at completion — they remain in the database but do not cause errors.

### Orphaned Verification Docs

A scheduled daily job automatically removes unsubmitted `LawyerProfile` verification documents for users who started onboarding as a lawyer but abandoned the flow (no `onboarding_completed_at`) after 30 days.

---

## Examples

### Example 1: Lawyer — Step-by-Step Flow

```bash
# Step 1
curl -X PUT "http://localhost:8000/api/onboarding/step" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"step": 1, "user_type": "lawyer"}'

# Step 2
curl -X PUT "http://localhost:8000/api/onboarding/step" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"step": 2, "communication_style": "co_worker"}'

# Step 3
curl -X PUT "http://localhost:8000/api/onboarding/step" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"step": 3, "country": "Nigeria", "country_code": "NG", "region": "Lagos", "city": "Lagos"}'

# Step 7 — areas of expertise
curl -X PUT "http://localhost:8000/api/onboarding/step" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"step": 7, "areas_of_expertise": [1, 3]}'

# Complete
curl -X POST "http://localhost:8000/api/onboarding/complete" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### Example 2: Law Student — Step-by-Step Flow

```bash
# Step 1
curl -X PUT "http://localhost:8000/api/onboarding/step" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"step": 1, "user_type": "law_student"}'

# Step 2
curl -X PUT "http://localhost:8000/api/onboarding/step" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"step": 2, "communication_style": "study_guide"}'

# Step 3
curl -X PUT "http://localhost:8000/api/onboarding/step" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"step": 3, "country": "Ghana", "country_code": "GH"}'

# Step 5 — university details
curl -X PUT "http://localhost:8000/api/onboarding/step" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"step": 5, "university": "University of Ghana", "level": "300"}'

# Step 7 — areas of expertise
curl -X PUT "http://localhost:8000/api/onboarding/step" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"step": 7, "areas_of_expertise": [2]}'

# Complete (profession auto-set to "student", area_of_study auto-set to "Law")
curl -X POST "http://localhost:8000/api/onboarding/complete" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### Example 3: Other User — Single-Request Completion

```bash
curl -X POST "http://localhost:8000/api/onboarding/complete" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_type": "other",
    "communication_style": "assistant",
    "country": "Kenya",
    "country_code": "KE",
    "region": "Nairobi",
    "city": "Nairobi",
    "profession": "journalist"
  }'
```

---

### Example 4: Resume After Interruption

```bash
# On app load — hydrate the frontend store
curl -X GET "http://localhost:8000/api/onboarding/progress" \
  -H "Authorization: Bearer {token}"

# Response shows step 3 was last completed
# Frontend resumes from step 4, continues...

curl -X PUT "http://localhost:8000/api/onboarding/step" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"step": 7, "areas_of_expertise": [1, 4]}'

curl -X POST "http://localhost:8000/api/onboarding/complete" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### Example 5: Verify Completion is Idempotent

```bash
# After completing, verify 409 is returned on further mutations
curl -X PUT "http://localhost:8000/api/onboarding/step" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"step": 2}'
# → 409 Onboarding already completed.

curl -X POST "http://localhost:8000/api/onboarding/complete" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{}'
# → 409 Onboarding already completed.

# GET progress still works normally
curl -X GET "http://localhost:8000/api/onboarding/progress" \
  -H "Authorization: Bearer {token}"
# → 200 with is_completed: true
```

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-21 | 1.0 | Initial release — GET progress, PUT step, POST complete |
