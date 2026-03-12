# Free Trial API - Frontend Reference

## Overview

The free trial system allows eligible users to try a paid plan for a limited period (default 30 days) before being charged. A small tokenization charge (₦100) is collected upfront to validate the user's card, then immediately refunded. After the trial period, Paystack automatically charges the full plan price.

**Key Features:**
- Card tokenization via Paystack (₦100 charge, auto-refunded)
- Per-user and per-card trial abuse prevention
- Configurable trial duration (default 30 days)
- Grace period on user cancellation (access continues until trial end)
- Admin management (list, view, force-cancel)
- Automatic trial reminders before expiry

**Payment Provider:** [Paystack](https://paystack.com) — tokenization and subscription creation happen through Paystack's hosted payment page.

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [User Endpoints](#user-endpoints)
   - [Check Eligibility](#get-apitrialeligibility)
   - [Start Trial](#post-apitrialstart)
   - [Verify Trial Payment](#get-apitrialverifyreference)
   - [Trial Status](#get-apitrialstatus)
   - [Cancel Trial](#post-apitrialcancel)
3. [Admin Endpoints](#admin-endpoints)
   - [List Trials](#get-apiadmintrials)
   - [Show Trial](#get-apiadmintrialsid)
   - [Admin Cancel Trial](#post-apiadmintrialsidcancel)
4. [Frontend Flows](#frontend-flows)
   - [Start Trial Flow](#flow-start-trial)
   - [Cancel Trial Flow](#flow-cancel-trial)
5. [Data Models](#data-models)
6. [Trial Status Reference](#trial-status-reference)
7. [Validation & Error Responses](#validation--error-responses)
8. [Settings Reference](#settings-reference)

---

## Authentication & Authorization

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/trial/eligibility` | GET | Yes | Any |
| `/api/trial/start` | POST | Yes | Any |
| `/api/trial/verify/{reference}` | GET | Yes | Any |
| `/api/trial/status` | GET | Yes | Any |
| `/api/trial/cancel` | POST | Yes | Any |
| `/api/admin/trials` | GET | Yes | Admin+ |
| `/api/admin/trials/{id}` | GET | Yes | Admin+ |
| `/api/admin/trials/{id}/cancel` | POST | Yes | Admin+ |

All endpoints use Bearer token authentication via `Authorization: Bearer {token}`.

**Rate Limit:** All user trial endpoints are throttled at 10 requests per minute.

**Unauthenticated (401):**

```json
{
  "success": false,
  "message": "Unauthenticated.",
  "errors": null
}
```

**Non-Admin User on Admin Endpoint (403):**

```json
{
  "success": false,
  "message": "Insufficient permissions. This action requires at least admin role."
}
```

---

## User Endpoints

### GET /api/trial/eligibility

Check whether the trial feature is enabled and if the authenticated user is eligible. Optionally check if a specific plan is trial-eligible.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `plan_id` | integer | No | Plan ID to check trial eligibility for |

**Example Requests:**

```bash
# Basic eligibility check
curl -X GET "http://localhost:8000/api/trial/eligibility" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"

# With plan eligibility check
curl -X GET "http://localhost:8000/api/trial/eligibility?plan_id=1" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response — Eligible User (200):**

```json
{
  "success": true,
  "message": "Trial eligibility checked.",
  "data": {
    "trial_enabled": true,
    "user_eligible": true
  }
}
```

**Response — Eligible User With Plan Check (200):**

```json
{
  "success": true,
  "message": "Trial eligibility checked.",
  "data": {
    "trial_enabled": true,
    "user_eligible": true,
    "plan_eligible": true
  }
}
```

**Response — Ineligible User (200):**

```json
{
  "success": true,
  "message": "Trial eligibility checked.",
  "data": {
    "trial_enabled": true,
    "user_eligible": false
  }
}
```

**Response — Trial Feature Disabled (200):**

```json
{
  "success": true,
  "message": "Trial eligibility checked.",
  "data": {
    "trial_enabled": false,
    "user_eligible": false
  }
}
```

**Response — Non-Eligible Plan (200):**

```json
{
  "success": true,
  "message": "Trial eligibility checked.",
  "data": {
    "trial_enabled": true,
    "user_eligible": true,
    "plan_eligible": false
  }
}
```

**Error — Plan Not Found (404):**

```json
{
  "success": false,
  "message": "Plan not found.",
  "errors": null
}
```

**Notes:**
- `user_eligible` is `false` when: the user has an active paid subscription, OR has already used a trial (active, converted, cancelled, or expired status)
- `user_eligible` is `true` if the user only has pending or aborted trials (these allow retry)
- `plan_eligible` is only included when `plan_id` is provided
- A plan is eligible when: `trial_eligible = true`, `is_active = true`, not free, and has a `plan_code`
- Use this endpoint to decide whether to show the "Start Free Trial" button on the pricing page

---

### POST /api/trial/start

Initialize a trial for a plan. Creates a Paystack tokenization transaction (₦100 charge) and returns a checkout URL.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `plan_id` | integer | Yes | ID of the plan to trial (must be active and trial-eligible) |
| `callback_url` | string (URL) | Yes | URL to redirect the user to after Paystack payment |

**Example Request:**

```bash
curl -X POST "http://localhost:8000/api/trial/start" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "plan_id": 1,
    "callback_url": "https://app.lawexa.com/trial/verify"
  }'
```

**Response (200):**

```json
{
  "success": true,
  "message": "Trial initialized. Complete payment to activate.",
  "data": {
    "authorization_url": "https://checkout.paystack.com/nh31j89ljy7nwu0",
    "access_code": "nh31j89ljy7nwu0",
    "reference": "trial_1_174_1773267279_XvaBMj89"
  }
}
```

**Error — User Not Eligible (422):**

```json
{
  "success": false,
  "message": "You are not eligible for a trial.",
  "errors": null
}
```

**Error — Trial Disabled (422):**

```json
{
  "success": false,
  "message": "Trial feature is currently disabled.",
  "errors": null
}
```

**Error — Free Plan (422):**

```json
{
  "success": false,
  "message": "Free plans cannot be trialed.",
  "errors": {
    "plan_id": ["Free plans cannot be trialed."]
  }
}
```

**Error — Plan Not Trial-Eligible (422):**

```json
{
  "success": false,
  "message": "This plan is not eligible for trial.",
  "errors": {
    "plan_id": ["This plan is not eligible for trial."]
  }
}
```

**Error — Inactive Plan (422):**

```json
{
  "success": false,
  "message": "The selected plan does not exist or is inactive.",
  "errors": {
    "plan_id": ["The selected plan does not exist or is inactive."]
  }
}
```

**Error — Missing Fields (422):**

```json
{
  "success": false,
  "message": "Please select a plan to trial. (and 1 more error)",
  "errors": {
    "plan_id": ["Please select a plan to trial."],
    "callback_url": ["A callback URL is required for trial initialization."]
  }
}
```

**Error — Invalid Callback URL (422):**

```json
{
  "success": false,
  "message": "The callback URL must be a valid URL.",
  "errors": {
    "callback_url": ["The callback URL must be a valid URL."]
  }
}
```

**Frontend Action:** Redirect the user to `authorization_url` via `window.location.href`. After the user enters their card and pays ₦100, Paystack redirects to `callback_url` with `?reference={reference}` appended.

**Notes:**
- The ₦100 charge is for card tokenization only — it is refunded automatically after verification
- If the user starts a new trial while an old one is still pending, the old one is automatically aborted
- A concurrency lock prevents duplicate initializations within 30 seconds

---

### GET /api/trial/verify/{reference}

Verify the Paystack tokenization payment and activate the trial. Called after the user returns from Paystack's payment page.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reference` | string | Yes | Trial reference returned by the start endpoint |

**Example Request:**

```bash
curl -X GET "http://localhost:8000/api/trial/verify/trial_1_174_1773267279_XvaBMj89" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response — Trial Activated (200):**

```json
{
  "success": true,
  "message": "Trial started successfully.",
  "data": {
    "id": 49,
    "plan": {
      "id": 1,
      "name": "Student",
      "slug": "student-monthly",
      "description": "Perfect for law students",
      "amount": "4900.00",
      "formatted_amount": "NGN 4,900.00",
      "currency": "NGN",
      "interval": "monthly",
      "interval_label": "Monthly",
      "interval_count": 1,
      "is_free": false,
      "is_featured": true,
      "features": [
        "Unlimited case views",
        "Unlimited note creations",
        "Advanced search",
        "Bookmark cases and notes"
      ],
      "limits": [
        { "type": "ai_messages", "value": 50, "is_unlimited": false, "period": "month" },
        { "type": "bookmarks", "value": -1, "is_unlimited": true, "period": "lifetime" },
        { "type": "note_creations", "value": -1, "is_unlimited": true, "period": "lifetime" }
      ]
    },
    "status": "active",
    "status_label": "Active",
    "card_last4": "4081",
    "card_type": "visa",
    "refund_status": "pending",
    "subscription": {
      "id": 38,
      "status": "trialing",
      "status_label": "Trialing",
      "amount": "4900.00",
      "currency": "NGN",
      "start_date": "2026-03-11T22:13:36+00:00",
      "next_payment_date": "2026-04-10T22:13:36+00:00",
      "cancelled_at": null,
      "ends_at": null,
      "days_until_renewal": 29,
      "is_in_grace_period": false,
      "has_access": true,
      "created_at": "2026-03-11T22:13:36+00:00"
    },
    "trial_starts_at": "2026-03-11T22:13:36+00:00",
    "trial_ends_at": "2026-04-10T22:13:36+00:00",
    "created_at": "2026-03-11T22:13:36+00:00",
    "updated_at": "2026-03-11T22:13:36+00:00"
  }
}
```

**Response — Already Active (200):**

```json
{
  "success": true,
  "message": "Trial already active.",
  "data": { "...same trial object as above..." }
}
```

**Error — Reference Not Found (404):**

```json
{
  "success": false,
  "message": "Trial reference not found.",
  "errors": null
}
```

**Error — Trial Can No Longer Be Verified (410):**

```json
{
  "success": false,
  "message": "This trial can no longer be verified.",
  "errors": null
}
```

**Error — Payment Not Completed (422):**

```json
{
  "success": false,
  "message": "Payment verification failed.",
  "errors": null
}
```

**Error — Card Already Used (422):**

```json
{
  "success": false,
  "message": "This card has already been used for a trial.",
  "errors": null
}
```

**Error — User No Longer Eligible (422):**

```json
{
  "success": false,
  "message": "You are no longer eligible for a trial.",
  "errors": null
}
```

**Notes:**
- Idempotent: calling verify multiple times for an already-active trial returns success
- The Paystack webhook may activate the trial before this endpoint is called — both paths are handled
- The ₦100 tokenization charge is refunded automatically during verification
- IDOR-safe: trying to verify another user's reference returns the same "not found" message
- The subscription is created with status `trialing` and `next_payment_date` set to the trial end date
- The user's existing free subscription (if any) is expired before creating the trial subscription

---

### GET /api/trial/status

Get the authenticated user's most recent trial (any status).

**Example Request:**

```bash
curl -X GET "http://localhost:8000/api/trial/status" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response — Active Trial (200):**

```json
{
  "success": true,
  "message": "Trial status retrieved.",
  "data": {
    "id": 49,
    "plan": {
      "id": 1,
      "name": "Student",
      "slug": "student-monthly",
      "description": "Perfect for law students",
      "amount": "4900.00",
      "formatted_amount": "NGN 4,900.00",
      "currency": "NGN",
      "interval": "monthly",
      "interval_label": "Monthly",
      "interval_count": 1,
      "is_free": false,
      "is_featured": true,
      "features": [
        "Unlimited case views",
        "Unlimited note creations",
        "Advanced search",
        "Bookmark cases and notes"
      ],
      "limits": [
        { "type": "ai_messages", "value": 50, "is_unlimited": false, "period": "month" },
        { "type": "bookmarks", "value": -1, "is_unlimited": true, "period": "lifetime" },
        { "type": "note_creations", "value": -1, "is_unlimited": true, "period": "lifetime" }
      ]
    },
    "status": "active",
    "status_label": "Active",
    "card_last4": "1111",
    "card_type": "mastercard",
    "refund_status": null,
    "subscription": {
      "id": 38,
      "status": "trialing",
      "status_label": "Trialing",
      "amount": "4900.00",
      "currency": "NGN",
      "start_date": "2026-03-11T22:13:36+00:00",
      "next_payment_date": "2026-04-10T22:13:36+00:00",
      "cancelled_at": null,
      "ends_at": null,
      "days_until_renewal": 29,
      "is_in_grace_period": false,
      "has_access": true,
      "created_at": "2026-03-11T22:13:36+00:00"
    },
    "trial_starts_at": "2026-03-11T22:13:36+00:00",
    "trial_ends_at": "2026-04-10T22:13:36+00:00",
    "created_at": "2026-03-11T22:13:36+00:00",
    "updated_at": "2026-03-11T22:13:36+00:00"
  }
}
```

**Response — Pending Trial (200):**

```json
{
  "success": true,
  "message": "Trial status retrieved.",
  "data": {
    "id": 51,
    "plan": { "...plan object..." },
    "status": "pending",
    "status_label": "Pending",
    "card_last4": null,
    "card_type": null,
    "refund_status": null,
    "subscription": null,
    "trial_starts_at": null,
    "trial_ends_at": null,
    "created_at": "2026-03-11T22:14:39+00:00",
    "updated_at": "2026-03-11T22:14:39+00:00"
  }
}
```

**Response — Cancelled Trial (200):**

```json
{
  "success": true,
  "message": "Trial status retrieved.",
  "data": {
    "id": 49,
    "plan": { "...plan object..." },
    "status": "cancelled",
    "status_label": "Cancelled",
    "card_last4": "1111",
    "card_type": "mastercard",
    "refund_status": null,
    "subscription": {
      "id": 38,
      "status": "cancelled",
      "status_label": "Cancelled",
      "amount": "4900.00",
      "currency": "NGN",
      "start_date": "2026-03-11T22:13:36+00:00",
      "next_payment_date": "2026-04-10T22:13:36+00:00",
      "cancelled_at": "2026-03-11T22:15:17+00:00",
      "ends_at": "2026-04-10T22:13:36+00:00",
      "days_until_renewal": null,
      "is_in_grace_period": false,
      "has_access": true,
      "created_at": "2026-03-11T22:13:36+00:00"
    },
    "trial_starts_at": "2026-03-11T22:13:36+00:00",
    "trial_ends_at": "2026-04-10T22:13:36+00:00",
    "created_at": "2026-03-11T22:13:36+00:00",
    "updated_at": "2026-03-11T22:15:17+00:00"
  }
}
```

**Error — No Trial Found (404):**

```json
{
  "success": false,
  "message": "No trial found.",
  "errors": null
}
```

**Notes:**
- Returns the most recent trial regardless of status (pending, active, cancelled, expired, converted, aborted)
- Only returns the authenticated user's own trial — no cross-user data leakage
- After cancellation, `subscription.has_access` remains `true` until `ends_at` passes
- Use `status` to determine what UI to show (trial banner, cancellation confirmation, etc.)

---

### POST /api/trial/cancel

Cancel the authenticated user's active trial. Access continues until the trial end date.

**Example Request:**

```bash
curl -X POST "http://localhost:8000/api/trial/cancel" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200):**

```json
{
  "success": true,
  "message": "Trial cancelled successfully.",
  "data": {
    "id": 49,
    "plan": { "...plan object..." },
    "status": "cancelled",
    "status_label": "Cancelled",
    "card_last4": "1111",
    "card_type": "mastercard",
    "refund_status": null,
    "subscription": {
      "id": 38,
      "status": "cancelled",
      "status_label": "Cancelled",
      "amount": "4900.00",
      "currency": "NGN",
      "start_date": "2026-03-11T22:13:36+00:00",
      "next_payment_date": "2026-04-10T22:13:36+00:00",
      "cancelled_at": "2026-03-11T22:15:17+00:00",
      "ends_at": "2026-04-10T22:13:36+00:00",
      "days_until_renewal": null,
      "is_in_grace_period": false,
      "has_access": true,
      "created_at": "2026-03-11T22:13:36+00:00"
    },
    "trial_starts_at": "2026-03-11T22:13:36+00:00",
    "trial_ends_at": "2026-04-10T22:13:36+00:00",
    "created_at": "2026-03-11T22:13:36+00:00",
    "updated_at": "2026-03-11T22:15:17+00:00"
  }
}
```

**Error — No Active Trial (404):**

```json
{
  "success": false,
  "message": "No active trial found.",
  "errors": null
}
```

**Notes:**
- Cancellation disables the Paystack subscription (no future charges)
- The user retains access until `trial_ends_at` (grace period)
- After `ends_at` passes, `has_access` becomes `false` and the user falls back to the free tier
- A cancelled trial cannot be restarted — the user must subscribe normally
- Calling cancel when no active trial exists returns 404

---

## Admin Endpoints

All admin endpoints require `auth:sanctum` middleware and `role:admin` (or higher).

### GET /api/admin/trials

List trial logs with filtering, sorting, and pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by trial status (`pending`, `active`, `converted`, `cancelled`, `expired`, `aborted`) |
| `user_id` | integer | - | Filter by user ID |
| `plan_id` | integer | - | Filter by plan ID |
| `card_signature` | string | - | Filter by card signature |
| `start_date` | date (Y-m-d) | - | Filter trials created on or after this date |
| `end_date` | date (Y-m-d) | - | Filter trials created on or before this date |
| `sort_by` | string | `created_at` | Sort field: `created_at`, `trial_starts_at`, `trial_ends_at`, `status` |
| `sort_order` | string | `desc` | Sort direction: `asc` or `desc` |
| `per_page` | integer | `15` | Items per page (clamped to 1–100) |

**Example Requests:**

```bash
# All trials
curl -X GET "http://localhost:8000/api/admin/trials" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Accept: application/json"

# Filter by status
curl -X GET "http://localhost:8000/api/admin/trials?status=active" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Accept: application/json"

# Filter by date range with sorting
curl -X GET "http://localhost:8000/api/admin/trials?start_date=2026-03-01&end_date=2026-03-31&sort_by=trial_starts_at&sort_order=asc" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Accept: application/json"
```

**Response (200):**

```json
{
  "success": true,
  "message": "Trial logs retrieved successfully.",
  "data": [
    {
      "id": 49,
      "user": {
        "id": 177,
        "name": "Active Trial User",
        "email": "user@example.com"
      },
      "plan": {
        "id": 1,
        "name": "Student",
        "slug": "student-monthly",
        "description": "Perfect for law students",
        "amount": "4900.00",
        "formatted_amount": "NGN 4,900.00",
        "currency": "NGN",
        "interval": "monthly",
        "interval_label": "Monthly",
        "interval_count": 1,
        "is_free": false,
        "is_featured": true,
        "features": ["..."],
        "limits": ["..."]
      },
      "status": "active",
      "status_label": "Active",
      "card_last4": "1111",
      "card_type": "mastercard",
      "refund_status": null,
      "subscription": {
        "id": 38,
        "status": "trialing",
        "status_label": "Trialing",
        "amount": "4900.00",
        "currency": "NGN",
        "start_date": "2026-03-11T22:13:36+00:00",
        "next_payment_date": "2026-04-10T22:13:36+00:00",
        "cancelled_at": null,
        "ends_at": null,
        "days_until_renewal": 29,
        "is_in_grace_period": false,
        "has_access": true,
        "created_at": "2026-03-11T22:13:36+00:00"
      },
      "trial_starts_at": "2026-03-11T22:13:36+00:00",
      "trial_ends_at": "2026-04-10T22:13:36+00:00",
      "created_at": "2026-03-11T22:13:36+00:00",
      "updated_at": "2026-03-11T22:13:36+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 25,
    "last_page": 2,
    "from": 1,
    "to": 15
  },
  "links": {
    "first": "http://localhost:8000/api/admin/trials?page=1",
    "last": "http://localhost:8000/api/admin/trials?page=2",
    "prev": null,
    "next": "http://localhost:8000/api/admin/trials?page=2"
  }
}
```

**Error — Invalid Status Filter (422):**

```json
{
  "success": false,
  "message": "Invalid status filter. Valid values: pending, active, converted, cancelled, expired, aborted.",
  "errors": null
}
```

---

### GET /api/admin/trials/{id}

View a single trial log with full details.

**Example Request:**

```bash
curl -X GET "http://localhost:8000/api/admin/trials/49" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Accept: application/json"
```

**Response (200):**

```json
{
  "success": true,
  "message": "Trial log retrieved successfully.",
  "data": {
    "id": 49,
    "user": {
      "id": 177,
      "name": "Active Trial User",
      "email": "user@example.com"
    },
    "plan": { "...plan object with limits..." },
    "status": "active",
    "status_label": "Active",
    "card_last4": "1111",
    "card_type": "mastercard",
    "refund_status": null,
    "subscription": { "...subscription object..." },
    "trial_starts_at": "2026-03-11T22:13:36+00:00",
    "trial_ends_at": "2026-04-10T22:13:36+00:00",
    "created_at": "2026-03-11T22:13:36+00:00",
    "updated_at": "2026-03-11T22:13:36+00:00"
  }
}
```

**Error — Trial Not Found (404):**

```json
{
  "success": false,
  "message": "Trial log not found.",
  "errors": null
}
```

---

### POST /api/admin/trials/{id}/cancel

Admin force-cancel an active trial. Unlike user cancellation, admin cancellation revokes access immediately.

**Example Request:**

```bash
curl -X POST "http://localhost:8000/api/admin/trials/49/cancel" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Accept: application/json"
```

**Response (200):**

```json
{
  "success": true,
  "message": "Trial cancelled successfully.",
  "data": {
    "id": 49,
    "user": {
      "id": 177,
      "name": "Active Trial User",
      "email": "user@example.com"
    },
    "plan": { "...plan object..." },
    "status": "cancelled",
    "status_label": "Cancelled",
    "card_last4": "1111",
    "card_type": "mastercard",
    "refund_status": null,
    "subscription": {
      "id": 38,
      "status": "cancelled",
      "status_label": "Cancelled",
      "cancelled_at": "2026-03-11T22:20:00+00:00",
      "ends_at": "2026-03-11T22:20:00+00:00",
      "has_access": false
    },
    "trial_starts_at": "2026-03-11T22:13:36+00:00",
    "trial_ends_at": "2026-04-10T22:13:36+00:00",
    "created_at": "2026-03-11T22:13:36+00:00",
    "updated_at": "2026-03-11T22:20:00+00:00"
  }
}
```

**Error — Trial Not Found (404):**

```json
{
  "success": false,
  "message": "Trial log not found.",
  "errors": null
}
```

**Error — Not an Active Trial (422):**

```json
{
  "success": false,
  "message": "Only active trials can be cancelled.",
  "errors": null
}
```

**Notes:**
- Admin cancel sets `ends_at` to `now()` — access is revoked immediately
- User cancel sets `ends_at` to `trial_ends_at` — access continues until end of trial period
- Both cancellation types disable the Paystack subscription to prevent future charges

---

## Frontend Flows

### Flow: Start Trial

```
1. User visits pricing page
   └─ GET /api/trial/eligibility?plan_id={id}
      ├─ trial_enabled=false → Hide trial option
      ├─ user_eligible=false → Show "Trial already used" message
      ├─ plan_eligible=false → Hide trial option for this plan
      └─ All true → Show "Start Free Trial" button

2. User clicks "Start Free Trial"
   └─ POST /api/trial/start { plan_id, callback_url }
      └─ Redirect to authorization_url

3. User completes Paystack payment (₦100)
   └─ Paystack redirects to callback_url?reference={ref}

4. Frontend extracts reference from URL
   └─ GET /api/trial/verify/{reference}
      ├─ Success → Show "Trial started!" + trial details
      ├─ "Payment verification failed" → Show retry message
      ├─ "Card already used" → Show "Use a different card" message
      └─ "No longer eligible" → Show error + redirect to pricing

5. Show trial status in dashboard
   └─ GET /api/trial/status
      └─ Display trial_ends_at countdown, plan features, cancel button
```

### Flow: Cancel Trial

```
1. User clicks "Cancel Trial" in dashboard
   └─ Show confirmation dialog:
      "Your trial will remain active until {trial_ends_at}.
       After that, you'll be downgraded to the free plan.
       No charges will be made."

2. User confirms
   └─ POST /api/trial/cancel
      └─ Show "Trial cancelled. Access until {ends_at}"

3. After trial_ends_at passes
   └─ GET /api/subscriptions/current
      └─ Falls back to free tier (subscription.has_access = false)
```

---

## Data Models

### Trial Log Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Trial log ID |
| `user` | object\|null | User info (admin endpoints only): `{ id, name, email }` |
| `plan` | PlanResource | The plan being trialed |
| `status` | string | Trial status (see [Trial Status Reference](#trial-status-reference)) |
| `status_label` | string | Human-readable status label |
| `card_last4` | string\|null | Last 4 digits of the card used |
| `card_type` | string\|null | Card type (e.g., `visa`, `mastercard`) |
| `refund_status` | string\|null | Refund status: `pending`, `processed`, `failed`, `null` |
| `subscription` | SubscriptionResource\|null | The trial subscription (null for pending trials) |
| `trial_starts_at` | ISO 8601\|null | When the trial started |
| `trial_ends_at` | ISO 8601\|null | When the trial ends/ended |
| `created_at` | ISO 8601 | When the trial was initialized |
| `updated_at` | ISO 8601 | Last update timestamp |

### Subscription Object (within Trial)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Subscription ID |
| `status` | string | `trialing` during trial, `cancelled` after cancel |
| `status_label` | string | Human-readable status |
| `amount` | string | Plan price (not charged during trial) |
| `currency` | string | Currency code (e.g., `NGN`) |
| `start_date` | ISO 8601 | Subscription start |
| `next_payment_date` | ISO 8601 | First real charge date (= trial end) |
| `cancelled_at` | ISO 8601\|null | When cancelled |
| `ends_at` | ISO 8601\|null | When access ends (set on cancellation) |
| `days_until_renewal` | integer\|null | Days until first charge (null if cancelled) |
| `is_in_grace_period` | boolean | Always `false` for trials |
| `has_access` | boolean | Whether user currently has plan access |

---

## Trial Status Reference

| Status | Value | Description | User Has Access | Can Start New Trial |
|--------|-------|-------------|:---------------:|:-------------------:|
| Pending | `pending` | Initialized, awaiting Paystack payment | No | Yes (retry) |
| Active | `active` | Payment verified, trial running | Yes | No |
| Converted | `converted` | Trial ended, first real charge succeeded | Yes (now paid) | No |
| Cancelled | `cancelled` | User or admin cancelled | Until `ends_at` | No |
| Expired | `expired` | Trial period ended without conversion | No | No |
| Aborted | `aborted` | Initialization failed or reversed | No | Yes (retry) |

**Lifecycle:**

```
Pending ──→ Active ──→ Converted (first charge success)
  │            │
  │            └──→ Cancelled (user or admin cancel)
  │            │
  │            └──→ Expired (trial period ended, charge failed)
  │
  └──→ Aborted (payment failed, card rejected, re-initialized)
```

---

## Validation & Error Responses

### Start Trial Validation Rules

| Field | Rules | Error Messages |
|-------|-------|---------------|
| `plan_id` | required, exists in plans (active only) | "Please select a plan to trial." / "The selected plan does not exist or is inactive." |
| `plan_id` | must not be free | "Free plans cannot be trialed." |
| `plan_id` | must be trial_eligible | "This plan is not eligible for trial." |
| `callback_url` | required, valid URL | "A callback URL is required..." / "The callback URL must be a valid URL." |

### Common Error Codes

| Status Code | Meaning |
|-------------|---------|
| 401 | Not authenticated |
| 403 | Insufficient role (admin endpoints) |
| 404 | Trial/plan not found |
| 410 | Trial can no longer be verified (terminal status) |
| 422 | Validation error or business rule violation |
| 429 | Rate limited (> 10 requests/minute) |

---

## Settings Reference

These settings control trial behavior and are managed via the admin settings system.

| Setting Key | Type | Default | Description |
|-------------|------|---------|-------------|
| `trial_enabled` | boolean | `false` | Master toggle for the trial feature |
| `trial_duration_days` | integer | `30` | Trial period length in days |
| `trial_tokenization_amount` | integer | `100` | Amount in Naira charged for card tokenization (refunded after verification) |
| `trial_reminder_enabled` | boolean | `true` | Whether to send reminder notifications before trial ends |
| `trial_reminder_days_before` | integer | `3` | Days before trial end to send the reminder |
