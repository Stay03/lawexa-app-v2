# Subscription & Plans API - Frontend Reference

## Overview

The subscription system manages user plan selection, payment processing via Paystack, subscription lifecycle (subscribe, upgrade, cancel), and invoice tracking. Plans define feature limits and pricing tiers; subscriptions link users to plans with billing state.

**Key Features:**
- Free and paid plan tiers with configurable limits (AI messages, bookmarks, notes)
- Paystack-integrated payment flow (initialize → redirect → verify)
- Prorated upgrades with credit for unused time on current plan
- Subscription cancellation with continued access until period end
- Invoice history with pagination
- Admin plan management (CRUD, limits, Paystack sync)
- Webhook-driven subscription lifecycle (charge success, renewal, failure)

**Payment Provider:** [Paystack](https://paystack.com) — all paid transactions are processed through Paystack's hosted payment page.

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [User Endpoints](#user-endpoints)
   - [List Plans](#get-apisubscriptionsplans)
   - [Current Subscription](#get-apisubscriptionscurrent)
   - [Subscribe (Free Plan)](#post-apisubscriptionssubscribe)
   - [Initialize Payment (Paid Plan)](#post-apisubscriptionsinitialize)
   - [Verify Payment](#get-apisubscriptionsverify)
   - [Initialize Upgrade](#post-apisubscriptionsupgrade)
   - [Verify Upgrade](#get-apisubscriptionsupgradeverify)
   - [Cancel Subscription](#post-apisubscriptionscancel)
   - [List Invoices](#get-apisubscriptionsinvoices)
3. [Admin Endpoints](#admin-endpoints)
   - [List All Plans](#get-apiadminplans)
   - [Show Plan](#get-apiadminplansid)
   - [Update Plan](#put-apiadminplansid)
   - [Update Plan Limits](#put-apiadminplansidlimits)
   - [Update Free Tier Limits](#put-apiadminplansfreelimits)
   - [Sync from Paystack](#post-apiadminplanssync)
4. [Frontend Flows](#frontend-flows)
   - [New User → Free Plan](#flow-new-user--free-plan)
   - [Free → Paid Plan](#flow-free--paid-plan)
   - [Upgrade (Paid → Higher Paid)](#flow-upgrade-paid--higher-paid)
   - [Cancel Subscription](#flow-cancel-subscription)
   - [Downgrade (Paid → Lower Paid)](#flow-downgrade-paid--lower-paid)
5. [Data Models](#data-models)
6. [Subscription Status Reference](#subscription-status-reference)
7. [Validation & Error Responses](#validation--error-responses)
8. [Known Gaps & Future Endpoints](#known-gaps--future-endpoints)

---

## Authentication & Authorization

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/subscriptions/plans` | GET | Yes | Any |
| `/api/subscriptions/current` | GET | Yes | Any |
| `/api/subscriptions/subscribe` | POST | Yes | Any |
| `/api/subscriptions/initialize` | POST | Yes | Any |
| `/api/subscriptions/verify` | GET | Yes | Any |
| `/api/subscriptions/upgrade` | POST | Yes | Any (must have active paid sub) |
| `/api/subscriptions/upgrade/verify` | GET | Yes | Any |
| `/api/subscriptions/cancel` | POST | Yes | Any |
| `/api/subscriptions/invoices` | GET | Yes | Any |
| `/api/admin/plans` | GET | Yes | Admin+ |
| `/api/admin/plans/{id}` | GET | Yes | Admin+ |
| `/api/admin/plans/{id}` | PUT | Yes | Admin+ |
| `/api/admin/plans/{id}/limits` | PUT | Yes | Admin+ |
| `/api/admin/plans/free/limits` | PUT | Yes | Admin+ |
| `/api/admin/plans/sync` | POST | Yes | Admin+ |

All endpoints use Bearer token authentication via `Authorization: Bearer {token}`.

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

### GET /api/subscriptions/plans

List all active plans with their features and limits. Plans are sorted by `sort_order`.

**Example Request:**

```bash
curl -X GET "http://localhost:8000/api/subscriptions/plans" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200):**

```json
{
  "success": true,
  "message": "Plans retrieved successfully.",
  "data": [
    {
      "id": 4,
      "name": "Free",
      "slug": "free",
      "description": "Basic access with limited views",
      "amount": "0.00",
      "formatted_amount": "Free",
      "currency": "NGN",
      "interval": "monthly",
      "interval_label": "Monthly",
      "interval_count": 1,
      "is_free": true,
      "is_featured": false,
      "features": [
        "10 case views per month",
        "5 note creations per month",
        "Basic search"
      ],
      "limits": [
        {
          "type": "ai_messages",
          "value": 0,
          "is_unlimited": false,
          "period": "lifetime"
        },
        {
          "type": "bookmarks",
          "value": 10,
          "is_unlimited": false,
          "period": "lifetime"
        },
        {
          "type": "note_creations",
          "value": 10,
          "is_unlimited": false,
          "period": "lifetime"
        }
      ]
    },
    {
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
        {
          "type": "ai_messages",
          "value": 50,
          "is_unlimited": false,
          "period": "month"
        },
        {
          "type": "bookmarks",
          "value": -1,
          "is_unlimited": true,
          "period": "lifetime"
        },
        {
          "type": "note_creations",
          "value": -1,
          "is_unlimited": true,
          "period": "lifetime"
        }
      ]
    }
  ]
}
```

**Notes:**
- Only active plans are returned (`is_active = true`)
- Use `is_featured` to highlight a recommended plan on the pricing page
- Limits with `is_unlimited: true` (value `-1`) mean no cap for that limit type
- Free plan limits use `period: "lifetime"` — these are permanent caps, not monthly resets

---

### GET /api/subscriptions/current

Get the authenticated user's current subscription status. Returns the active subscription if one exists, or falls back to the free plan.

**Example Request:**

```bash
curl -X GET "http://localhost:8000/api/subscriptions/current" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response — User With Paid Subscription (200):**

```json
{
  "success": true,
  "message": "Subscription retrieved successfully.",
  "data": {
    "subscription": {
      "id": 1,
      "plan": {
        "id": 5,
        "name": "Student Annual",
        "slug": "student-annual",
        "description": "Annual student plan",
        "amount": "49000.00",
        "formatted_amount": "NGN 49,000.00",
        "currency": "NGN",
        "interval": "annually",
        "interval_label": "Annually",
        "interval_count": 1,
        "is_free": false,
        "is_featured": false,
        "features": [],
        "limits": [
          {
            "type": "ai_messages",
            "value": 50,
            "is_unlimited": false,
            "period": "billing_interval"
          }
        ]
      },
      "status": "active",
      "status_label": "Active",
      "amount": "49000.00",
      "currency": "NGN",
      "start_date": "2026-01-15T00:00:00+00:00",
      "next_payment_date": "2027-01-15T00:00:00+00:00",
      "cancelled_at": null,
      "ends_at": null,
      "days_until_renewal": 314,
      "is_in_grace_period": false,
      "has_access": true,
      "created_at": "2026-03-05T13:59:02+00:00"
    },
    "plan": { "...same plan object..." },
    "is_free_tier": false
  }
}
```

**Response — User With No Subscription / Free Tier (200):**

```json
{
  "success": true,
  "message": "No active subscription. Using free tier.",
  "data": {
    "subscription": null,
    "plan": {
      "id": 4,
      "name": "Free",
      "slug": "free",
      "amount": "0.00",
      "formatted_amount": "Free",
      "is_free": true,
      "limits": [
        { "type": "ai_messages", "value": 0, "is_unlimited": false, "period": "lifetime" },
        { "type": "bookmarks", "value": 10, "is_unlimited": false, "period": "lifetime" },
        { "type": "note_creations", "value": 10, "is_unlimited": false, "period": "lifetime" }
      ]
    },
    "is_free_tier": true
  }
}
```

**Response — User With Cancelled Subscription (Still Has Access) (200):**

```json
{
  "success": true,
  "message": "Subscription retrieved successfully.",
  "data": {
    "subscription": {
      "status": "cancelled",
      "status_label": "Cancelled",
      "cancelled_at": "2026-03-06T15:57:04+00:00",
      "ends_at": "2027-01-15T00:00:00+00:00",
      "has_access": true
    },
    "plan": { "..." },
    "is_free_tier": false
  }
}
```

**Frontend Logic:**
- Use `is_free_tier` to decide whether to show upgrade prompts
- Use `subscription.has_access` to determine if user can access paid features
- Use `subscription.status` to show appropriate UI (active badge, cancellation notice, etc.)
- When `subscription` is `null`, the user has no subscription record — display free tier limits
- When `subscription.status` is `"cancelled"` and `has_access` is `true`, show: "Your plan is cancelled. Access continues until {ends_at}"
- `days_until_renewal` is `null` for free plans (no renewal)

---

### POST /api/subscriptions/subscribe

Subscribe to the **free plan only**. For paid plans, use the [initialize](#post-apisubscriptionsinitialize) endpoint.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `plan_id` | integer | Yes | ID of the free plan |

**Example Request:**

```bash
curl -X POST "http://localhost:8000/api/subscriptions/subscribe" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"plan_id": 4}'
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Successfully subscribed to free plan.",
  "data": {
    "id": 7,
    "plan": { "...plan object..." },
    "status": "active",
    "status_label": "Active",
    "amount": "0.00",
    "currency": "NGN",
    "start_date": "2026-03-06T15:55:25+00:00",
    "next_payment_date": null,
    "has_access": true
  }
}
```

**Error — Paid Plan Passed (400):**

```json
{
  "success": false,
  "message": "Use the initialize endpoint for paid plans.",
  "errors": null
}
```

**Error — Already Has Active Subscription (422):**

```json
{
  "success": false,
  "message": "You already have an active subscription. Please upgrade or cancel your current subscription first.",
  "errors": {
    "plan_id": ["You already have an active subscription. Please upgrade or cancel your current subscription first."]
  }
}
```

**Error — Cancelled Sub Still Has Access (422):**

```json
{
  "success": false,
  "message": "Your cancelled subscription still has access until 2027-01-15. You cannot switch to the free plan until then.",
  "errors": {
    "plan_id": ["Your cancelled subscription still has access until 2027-01-15. You cannot switch to the free plan until then."]
  }
}
```

**Error — Inactive Plan (422):**

```json
{
  "success": false,
  "message": "This plan is no longer available.",
  "errors": {
    "plan_id": ["This plan is no longer available."]
  }
}
```

---

### POST /api/subscriptions/initialize

Initialize a Paystack payment session for a **paid plan**. Returns a URL to redirect the user to Paystack's hosted payment page.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `plan_id` | integer | Yes | ID of the paid plan |
| `callback_url` | string (URL) | No | Custom callback URL after payment. Defaults to `{APP_URL}/api/subscriptions/verify` |

**Example Request:**

```bash
curl -X POST "http://localhost:8000/api/subscriptions/initialize" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"plan_id": 1, "callback_url": "https://app.lawexa.com/subscription/verify"}'
```

**Response (200):**

```json
{
  "success": true,
  "message": "Payment initialized. Redirect user to authorization URL.",
  "data": {
    "authorization_url": "https://checkout.paystack.com/abc123xyz",
    "access_code": "abc123xyz",
    "reference": "txn_ref_1234567890",
    "plan": {
      "id": 1,
      "name": "Student",
      "slug": "student-monthly",
      "amount": "4900.00",
      "formatted_amount": "NGN 4,900.00"
    }
  }
}
```

**Error — Free Plan (400):**

```json
{
  "success": false,
  "message": "Cannot initialize payment for free plan. Use subscribe endpoint.",
  "errors": null
}
```

**Frontend Action:** Redirect the user to `authorization_url` in a new tab or via `window.location.href`. After payment, Paystack redirects to `callback_url` with `?reference={reference}` appended.

---

### GET /api/subscriptions/verify

Verify a Paystack payment and create the subscription. Called after the user returns from Paystack's payment page.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reference` | string | Yes* | Payment reference from Paystack |
| `trxref` | string | Yes* | Alternative parameter name (Paystack sends both) |

*At least one of `reference` or `trxref` must be present.

**Example Request:**

```bash
curl -X GET "http://localhost:8000/api/subscriptions/verify?reference=txn_ref_1234567890" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200):**

```json
{
  "success": true,
  "message": "Subscription created successfully.",
  "data": {
    "id": 3,
    "plan": { "...plan object with limits..." },
    "status": "active",
    "status_label": "Active",
    "amount": "4900.00",
    "currency": "NGN",
    "start_date": "2026-03-06T16:00:00+00:00",
    "next_payment_date": "2026-04-05T16:00:00+00:00",
    "has_access": true
  }
}
```

**Response — Already Processed (200):**

```json
{
  "success": true,
  "message": "Subscription already active.",
  "data": { "...subscription object..." }
}
```

**Error — Missing Reference (400):**

```json
{
  "success": false,
  "message": "Payment reference is required.",
  "errors": null
}
```

**Error — Payment Failed / Invalid Reference (400):**

```json
{
  "success": false,
  "message": "Payment verification failed.",
  "errors": null
}
```

**Error — Reference Belongs to Different User (400):**

```json
{
  "success": false,
  "message": "Payment reference does not belong to this user.",
  "errors": null
}
```

**Notes:**
- Idempotent: calling verify multiple times with the same reference is safe
- Webhooks may create the subscription before the verify call — the endpoint handles this gracefully
- The user's existing subscriptions are expired before creating the new one

---

### POST /api/subscriptions/upgrade

Initialize an upgrade from the current paid plan to a higher-priced plan. Calculates prorated credit for unused time on the current plan.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `plan_id` | integer | Yes | ID of the higher-priced plan to upgrade to |
| `callback_url` | string (URL) | No | Custom callback URL after payment |

**Example Request:**

```bash
curl -X POST "http://localhost:8000/api/subscriptions/upgrade" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"plan_id": 3}'
```

**Response — Payment Required (200):**

```json
{
  "success": true,
  "message": "Upgrade payment initialized. Redirect user to authorization URL.",
  "data": {
    "authorization_url": "https://checkout.paystack.com/upgrade_abc",
    "access_code": "upgrade_abc",
    "reference": "upgrade_2_1709740000_aB3cD4eF",
    "proration": {
      "remaining_days": 280,
      "credit": 37589.04,
      "new_amount": 62410.96,
      "effective_immediately": true
    }
  }
}
```

**Response — No Payment Needed (Proration Covers Full Cost) (200):**

```json
{
  "success": true,
  "message": "Subscription upgraded successfully.",
  "data": {
    "subscription": { "...new subscription object..." },
    "proration": {
      "remaining_days": 350,
      "credit": 47123.29,
      "new_amount": 0,
      "effective_immediately": true
    }
  }
}
```

**Error — Upgrade to Free Plan (422):**

```json
{
  "success": false,
  "message": "Cannot upgrade to a free plan.",
  "errors": { "plan_id": ["Cannot upgrade to a free plan."] }
}
```

**Error — Upgrade from Free Plan (422):**

```json
{
  "success": false,
  "message": "Cannot upgrade from free plan. Please subscribe to a paid plan first.",
  "errors": { "plan_id": ["Cannot upgrade from free plan. Please subscribe to a paid plan first."] }
}
```

**Error — Same Plan (422):**

```json
{
  "success": false,
  "message": "You are already on this plan.",
  "errors": { "plan_id": ["You are already on this plan."] }
}
```

**Error — Downgrade Attempt (422):**

```json
{
  "success": false,
  "message": "To downgrade, please cancel your current subscription and subscribe to the new plan.",
  "errors": { "plan_id": ["To downgrade, please cancel your current subscription and subscribe to the new plan."] }
}
```

**Error — No Active Subscription (403):**

```json
{
  "success": false,
  "message": "This action is unauthorized.",
  "errors": null
}
```

**Proration Logic:**
- `remaining_days`: days left on current billing period
- `credit`: unused portion of current plan's payment (proportional to remaining days)
- `new_amount`: new plan price minus credit (always ≥ 0)
- If `new_amount` is 0 or negative, the upgrade completes immediately without Paystack payment

---

### GET /api/subscriptions/upgrade/verify

Verify an upgrade payment and complete the plan switch. Called after user returns from Paystack.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reference` | string | Yes* | Upgrade payment reference |
| `trxref` | string | Yes* | Alternative parameter name |

**Example Request:**

```bash
curl -X GET "http://localhost:8000/api/subscriptions/upgrade/verify?reference=upgrade_2_1709740000_aB3cD4eF" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200):**

```json
{
  "success": true,
  "message": "Subscription upgraded successfully.",
  "data": {
    "subscription": {
      "id": 5,
      "plan": { "...new plan object..." },
      "status": "active",
      "amount": "100000.00",
      "start_date": "2026-03-06T16:00:00+00:00",
      "next_payment_date": "2026-04-05T16:00:00+00:00",
      "has_access": true
    },
    "proration": {
      "credit": 37589.04,
      "new_amount": 62410.96
    }
  }
}
```

**Notes:**
- The old subscription is set to `expired` status
- A new subscription record is created for the new plan
- An invoice is created for the prorated charge
- Idempotent: calling verify again returns "Upgrade already processed."

---

### POST /api/subscriptions/cancel

Cancel the current paid subscription. Access continues until the end of the billing period.

**Example Request:**

```bash
curl -X POST "http://localhost:8000/api/subscriptions/cancel" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200):**

```json
{
  "success": true,
  "message": "Subscription cancelled. Access continues until 2027-01-15.",
  "data": {
    "id": 1,
    "plan": { "...plan object..." },
    "status": "cancelled",
    "status_label": "Cancelled",
    "cancelled_at": "2026-03-06T15:57:04+00:00",
    "ends_at": "2027-01-15T00:00:00+00:00",
    "has_access": true
  }
}
```

**Error — No Active Subscription (404):**

```json
{
  "success": false,
  "message": "No active subscription to cancel.",
  "errors": null
}
```

**Error — Free Subscription (400):**

```json
{
  "success": false,
  "message": "Cannot cancel free tier subscription.",
  "errors": null
}
```

**Error — Already Cancelled (400):**

```json
{
  "success": false,
  "message": "Subscription is already cancelled. Access continues until 2027-01-15.",
  "errors": null
}
```

**Notes:**
- Cancellation is immediate in Paystack (no further charges)
- User retains access until `ends_at` (set to `next_payment_date`)
- After `ends_at` passes, `has_access` becomes `false` and `/current` falls back to free tier

---

### GET /api/subscriptions/invoices

List the authenticated user's subscription invoices across all subscriptions, newest first.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `per_page` | integer | `15` | Items per page (clamped to 1–100) |
| `page` | integer | `1` | Page number |

**Example Request:**

```bash
curl -X GET "http://localhost:8000/api/subscriptions/invoices?per_page=10" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200):**

```json
{
  "success": true,
  "message": "Invoices retrieved successfully.",
  "data": [
    {
      "id": 1,
      "invoice_code": "INV_local_01KK1XZA1XB9Q1ZM8EBX0QHPRH",
      "amount": "49000.00",
      "formatted_amount": "NGN 49,000.00",
      "currency": "NGN",
      "status": "success",
      "status_label": "Successful",
      "paid": true,
      "paid_at": "2026-03-06T15:59:00+00:00",
      "period_start": "2026-03-06",
      "period_end": "2026-04-06",
      "description": null,
      "created_at": "2026-03-06T15:59:00+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 10,
    "total": 3,
    "last_page": 1,
    "from": 1,
    "to": 3
  },
  "links": {
    "first": "http://localhost:8000/api/subscriptions/invoices?page=1",
    "last": "http://localhost:8000/api/subscriptions/invoices?page=1",
    "prev": null,
    "next": null
  }
}
```

**Response — No Invoices (200):**

```json
{
  "success": true,
  "message": "Invoices retrieved successfully.",
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
    "first": "http://localhost:8000/api/subscriptions/invoices?page=1",
    "last": "http://localhost:8000/api/subscriptions/invoices?page=1",
    "prev": null,
    "next": null
  }
}
```

**Notes:**
- Returns invoices across ALL of the user's subscriptions (current and past)
- Free plan subscriptions generate no invoices
- `per_page` values below 1 are clamped to 1, above 100 are clamped to 100

---

## Admin Endpoints

All admin endpoints require `auth:sanctum` middleware and `role:admin` (or higher).

### GET /api/admin/plans

List all plans (including inactive) with subscription counts and limits.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `is_active` | boolean | - | Filter by active status (omit for all) |
| `per_page` | integer | `15` | Items per page (1–100) |
| `page` | integer | `1` | Page number |

**Example Requests:**

```bash
# All plans
curl -X GET "http://localhost:8000/api/admin/plans" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Accept: application/json"

# Active only
curl -X GET "http://localhost:8000/api/admin/plans?is_active=true" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Accept: application/json"
```

**Response (200):**

```json
{
  "success": true,
  "message": "Plans retrieved successfully.",
  "data": [
    {
      "id": 4,
      "name": "Free",
      "slug": "free",
      "description": "Basic access with limited views",
      "amount": "0.00",
      "formatted_amount": "Free",
      "currency": "NGN",
      "interval": "monthly",
      "interval_label": "Monthly",
      "interval_count": 1,
      "is_free": true,
      "is_featured": false,
      "features": ["10 case views per month", "5 note creations per month", "Basic search"],
      "limits": [
        { "type": "ai_messages", "value": 0, "is_unlimited": false, "period": "lifetime" },
        { "type": "bookmarks", "value": 10, "is_unlimited": false, "period": "lifetime" },
        { "type": "note_creations", "value": 10, "is_unlimited": false, "period": "lifetime" }
      ],
      "subscriptions_count": 2
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 5,
    "last_page": 1,
    "from": 1,
    "to": 5
  },
  "links": {
    "first": "http://localhost:8000/api/admin/plans?page=1",
    "last": "http://localhost:8000/api/admin/plans?page=1",
    "prev": null,
    "next": null
  }
}
```

**Notes:**
- `subscriptions_count` shows how many subscriptions reference each plan
- Sorted by `sort_order` ascending

---

### GET /api/admin/plans/{id}

Show a single plan with its limits and recent subscriptions.

**Example Request:**

```bash
curl -X GET "http://localhost:8000/api/admin/plans/1" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Accept: application/json"
```

**Response (200):**

```json
{
  "success": true,
  "message": "Plan retrieved successfully.",
  "data": {
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
    "features": ["Unlimited case views", "Unlimited note creations", "Advanced search", "Bookmark cases and notes"],
    "limits": [
      { "type": "ai_messages", "value": 50, "is_unlimited": false, "period": "month" },
      { "type": "bookmarks", "value": -1, "is_unlimited": true, "period": "lifetime" },
      { "type": "note_creations", "value": -1, "is_unlimited": true, "period": "lifetime" }
    ],
    "subscriptions_count": 0
  }
}
```

**Error — Plan Not Found (404):**

```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

---

### PUT /api/admin/plans/{id}

Update a plan's metadata. Cannot change `plan_code`, `amount`, `currency`, or `interval` (these are managed by Paystack sync).

**Request Body (all fields optional):**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Plan display name (max 100 chars) |
| `description` | string\|null | Plan description |
| `is_active` | boolean | Whether the plan is available for new subscriptions |
| `is_featured` | boolean | Whether to highlight on pricing page |
| `sort_order` | integer (≥0) | Display order (lower = first) |
| `features` | array of strings | Feature bullet points |

**Example Request:**

```bash
curl -X PUT "http://localhost:8000/api/admin/plans/1" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "description": "Updated plan description",
    "is_featured": true,
    "sort_order": 1,
    "features": ["Feature A", "Feature B"]
  }'
```

**Response (200):**

```json
{
  "success": true,
  "message": "Plan updated successfully.",
  "data": { "...updated plan object..." }
}
```

---

### PUT /api/admin/plans/{id}/limits

Update or create limits for a specific plan.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `limits` | array | Yes | At least one limit object |
| `limits[].limit_type` | string | Yes | Limit type (`ai_messages`, `bookmarks`, `note_creations`) |
| `limits[].limit_value` | integer | Yes | Limit value (`-1` for unlimited, `0` for none) |
| `limits[].period` | string | No | Reset period: `month`, `billing_interval`, `lifetime` (default: `month`) |

**Example Request:**

```bash
curl -X PUT "http://localhost:8000/api/admin/plans/1/limits" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "limits": [
      {"limit_type": "ai_messages", "limit_value": 100, "period": "month"},
      {"limit_type": "bookmarks", "limit_value": -1, "period": "lifetime"}
    ]
  }'
```

**Response (200):**

```json
{
  "success": true,
  "message": "Plan limits updated successfully.",
  "data": { "...plan object with updated limits..." }
}
```

**Error — Empty Limits (422):**

```json
{
  "success": false,
  "message": "At least one limit must be specified.",
  "errors": { "limits": ["At least one limit must be specified."] }
}
```

---

### PUT /api/admin/plans/free/limits

Update the global free tier limits. These apply to all users on the free plan (stored with `plan_id = NULL`).

**Request Body:** Same format as [Update Plan Limits](#put-apiadminplansidlimits).

**Example Request:**

```bash
curl -X PUT "http://localhost:8000/api/admin/plans/free/limits" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "limits": [
      {"limit_type": "ai_messages", "limit_value": 5, "period": "month"},
      {"limit_type": "note_creations", "limit_value": 10, "period": "lifetime"}
    ]
  }'
```

**Response (200):**

```json
{
  "success": true,
  "message": "Free tier limits updated successfully.",
  "data": [
    { "type": "ai_messages", "value": 5, "is_unlimited": false, "period": "month" },
    { "type": "bookmarks", "value": 10, "is_unlimited": false, "period": "lifetime" },
    { "type": "note_creations", "value": 10, "is_unlimited": false, "period": "lifetime" }
  ]
}
```

---

### POST /api/admin/plans/sync

Sync plans from Paystack. Creates or updates local plans to match Paystack's active plans, deactivates plans no longer on Paystack, and ensures the free plan exists.

**Example Request:**

```bash
curl -X POST "http://localhost:8000/api/admin/plans/sync" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Accept: application/json"
```

**Response (200):**

```json
{
  "success": true,
  "message": "Synced 4 plans from Paystack.",
  "data": {
    "synced_count": 4,
    "deactivated_count": 0,
    "paystack_plans": 4
  }
}
```

**Notes:**
- Archived Paystack plans are skipped
- Local plans not found in active Paystack plans are deactivated
- Runs `PlanLimitSeeder` after sync to apply default limits to new plans
- Free plan is always created/preserved (it has no `plan_code`)

---

## Frontend Flows

### Flow: New User → Free Plan

```
1. User signs up → no subscription exists
2. GET /current → returns { subscription: null, is_free_tier: true }
3. Show pricing page with plans from GET /plans
4. User selects free plan → POST /subscribe { plan_id: 4 }
5. 201 → subscription created, show success
```

### Flow: Free → Paid Plan

```
1. GET /current → is_free_tier: true
2. User selects paid plan on pricing page
3. POST /initialize { plan_id: 1, callback_url: "https://app.lawexa.com/subscription/callback" }
4. 200 → get authorization_url
5. Redirect user to authorization_url (Paystack payment page)
6. User pays → Paystack redirects to callback_url?reference=xxx
7. Frontend extracts reference from URL query params
8. GET /verify?reference=xxx
9. 200 → subscription active, update UI
```

### Flow: Upgrade (Paid → Higher Paid)

```
1. GET /current → show current plan
2. GET /plans → show available higher-tier plans
3. User selects higher plan → POST /upgrade { plan_id: 3 }
4. Check response:
   a. If response has authorization_url → redirect to Paystack
      → After payment: GET /upgrade/verify?reference=xxx
   b. If response has subscription object (credit covers full cost) → upgrade complete
5. Update UI with new plan
```

### Flow: Cancel Subscription

```
1. Show confirmation dialog with current plan details
2. POST /cancel
3. 200 → show "Cancelled. Access continues until {ends_at}"
4. Update UI: show cancellation banner with end date
5. After ends_at passes, GET /current returns is_free_tier: true
```

### Flow: Downgrade (Paid → Lower Paid)

There is no direct downgrade endpoint. The flow is:

```
1. POST /cancel → cancel current subscription
2. Wait until ends_at passes (subscription expires)
3. POST /subscribe (free) or POST /initialize (lower paid plan)
```

The frontend should communicate this clearly: "To switch to a lower plan, cancel your current subscription. Once your current billing period ends on {ends_at}, you can subscribe to the new plan."

---

## Data Models

### Plan Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Plan ID |
| `name` | string | Display name (e.g., "Student") |
| `slug` | string | URL-safe identifier (e.g., "student-monthly") |
| `description` | string\|null | Plan description |
| `amount` | string | Price as decimal string (e.g., "4900.00") |
| `formatted_amount` | string | Display price (e.g., "NGN 4,900.00" or "Free") |
| `currency` | string | Currency code (e.g., "NGN") |
| `interval` | string | Billing interval: `daily`, `weekly`, `monthly`, `quarterly`, `biannually`, `annually` |
| `interval_label` | string | Human-readable interval (e.g., "Monthly") |
| `interval_count` | integer | Number of intervals per billing cycle |
| `is_free` | boolean | Whether this is a free plan |
| `is_featured` | boolean | Whether to highlight on pricing page |
| `features` | array | Feature bullet points for display |
| `limits` | array | Plan limits (see Limit Object) |
| `subscriptions_count` | integer\|null | Total subscriptions (admin only) |

### Limit Object

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Limit type: `ai_messages`, `bookmarks`, `note_creations` |
| `value` | integer | Limit value. `-1` = unlimited, `0` = none |
| `is_unlimited` | boolean | `true` when value is `-1` |
| `period` | string | Reset period: `month`, `billing_interval`, `lifetime` |

### Subscription Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Subscription ID |
| `plan` | object | Nested Plan object (when loaded) |
| `status` | string | One of: `active`, `past_due`, `cancelled`, `expired`, `trialing` |
| `status_label` | string | Human-readable status |
| `amount` | string | Subscription price |
| `currency` | string | Currency code |
| `start_date` | string (ISO 8601) | When the subscription started |
| `next_payment_date` | string\|null (ISO 8601) | Next billing date (`null` for free) |
| `cancelled_at` | string\|null (ISO 8601) | When cancellation was requested |
| `ends_at` | string\|null (ISO 8601) | When access ends (set on cancellation) |
| `days_until_renewal` | integer\|null | Days until next payment (`null` for free) |
| `is_in_grace_period` | boolean | `true` if past_due but within grace days |
| `has_access` | boolean | Whether user has access to paid features |
| `created_at` | string (ISO 8601) | Record creation timestamp |

### Invoice Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Invoice ID |
| `invoice_code` | string | Unique invoice code |
| `amount` | string | Invoice amount |
| `formatted_amount` | string | Display amount (e.g., "NGN 49,000.00") |
| `currency` | string | Currency code |
| `status` | string | One of: `pending`, `success`, `failed` |
| `status_label` | string | Human-readable status |
| `paid` | boolean | Whether the invoice was paid |
| `paid_at` | string\|null (ISO 8601) | Payment timestamp |
| `period_start` | string (date) | Billing period start (YYYY-MM-DD) |
| `period_end` | string (date) | Billing period end (YYYY-MM-DD) |
| `description` | string\|null | Invoice description |
| `created_at` | string (ISO 8601) | Record creation timestamp |

---

## Subscription Status Reference

| Status | Value | Has Access | Description |
|--------|-------|------------|-------------|
| Active | `active` | Yes | Subscription is current and paid |
| Past Due | `past_due` | Yes (grace period) | Payment failed, within grace period |
| Cancelled | `cancelled` | Yes (until `ends_at`) | User cancelled, access continues until period end |
| Expired | `expired` | No | Subscription has ended |
| Trialing | `trialing` | Yes | In trial period |

**Access Logic:**
- `has_access = true` when status is `active`, `past_due`, `trialing`, or `cancelled` with `ends_at` in the future
- When `has_access = false`, the user falls back to free tier limits

---

## Validation & Error Responses

All validation errors return **422** with this structure:

```json
{
  "success": false,
  "message": "Summary of first error. (and N more errors)",
  "errors": {
    "field_name": ["Error message 1", "Error message 2"]
  }
}
```

### Subscribe Validation Rules

| Rule | Error Message |
|------|---------------|
| `plan_id` is required | "Please select a subscription plan." |
| `plan_id` must exist | "The selected plan does not exist." |
| Already has active sub | "You already have an active subscription. Please upgrade or cancel your current subscription first." |
| Cancelled sub still has access (switching to free) | "Your cancelled subscription still has access until {date}. You cannot switch to the free plan until then." |
| Plan is inactive | "This plan is no longer available." |
| `callback_url` must be valid URL | "The callback URL must be a valid URL." |

### Upgrade Validation Rules

| Rule | Error Message |
|------|---------------|
| No active subscription | 403 "This action is unauthorized." |
| Target is free plan | "Cannot upgrade to a free plan." |
| Currently on free plan | "Cannot upgrade from free plan. Please subscribe to a paid plan first." |
| Same plan | "You are already on this plan." |
| Target is cheaper (downgrade) | "To downgrade, please cancel your current subscription and subscribe to the new plan." |
| Target plan is inactive | "This plan is no longer available." |

---

## Known Gaps & Future Endpoints

The following capabilities are **not yet available** as API endpoints. Frontend teams should be aware of these limitations and plan UI accordingly.

| Feature | Status | Workaround |
|---------|--------|------------|
| **Reactivation** (undo cancel before period ends) | Backend service exists, no HTTP route | None — user must wait for expiry and re-subscribe |
| **Public plans listing** (unauthenticated pricing page) | Plans require auth | Show static pricing or require login first |
| **Single invoice detail** (`GET /invoices/{id}`) | Not implemented | Use list endpoint and filter client-side |
| **Invoice PDF download** | Not implemented | None |
| **Update payment method** | Not implemented | None — Paystack handles via email-based card update |
| **Retry failed payment** | Not implemented | User must wait for Paystack auto-retry or re-subscribe |
| **Subscription history** (past expired subscriptions) | Not implemented | Only current/active subscription is surfaced |
| **Downgrade endpoint** | By design — not a single action | Cancel → wait for expiry → re-subscribe to lower plan |
