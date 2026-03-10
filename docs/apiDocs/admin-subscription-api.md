# Admin Subscription Management - API Documentation

## Overview

These endpoints provide admin-level access to subscription and subscriber data for the admin dashboard. Endpoints support filtering, sorting, pagination, and subscription lifecycle management.

**Key Features:**
- List all subscriptions with advanced filtering (status, plan, user search, date range, amount range)
- View detailed subscription information including recent invoices
- List all subscribers with their most recent subscription
- Cancel a user's subscription (disables in Paystack, sets access end date)
- Reactivate a cancelled subscription (re-enables in Paystack, restores active status)
- Computed fields: `days_until_renewal`, `is_in_grace_period`, `has_access`

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [List Subscriptions](#list-subscriptions)
3. [Show Subscription](#show-subscription)
4. [Cancel Subscription](#cancel-subscription)
5. [Reactivate Subscription](#reactivate-subscription)
6. [List Subscribers](#list-subscribers)
7. [Data Models](#data-models)
8. [Validation & Error Responses](#validation--error-responses)
9. [Implementation Files](#implementation-files)

---

## Authentication & Authorization

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/admin/subscriptions` | GET | Yes | Admin |
| `/api/admin/subscriptions/{id}` | GET | Yes | Admin |
| `/api/admin/subscriptions/{id}/cancel` | POST | Yes | Admin |
| `/api/admin/subscriptions/{id}/reactivate` | POST | Yes | Admin |
| `/api/admin/subscribers` | GET | Yes | Admin |

**Middleware:** `auth:sanctum`, `role:admin`

**Unauthenticated (401):**

```json
{
  "success": false,
  "message": "Unauthenticated.",
  "errors": null
}
```

**Non-Admin User (403):**

```json
{
  "success": false,
  "message": "Insufficient permissions. This action requires at least admin role."
}
```

---

## List Subscriptions

### GET /api/admin/subscriptions

Retrieve a paginated list of all subscriptions with optional filtering and sorting.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status: `active`, `past_due`, `cancelled`, `expired`, `trialing` |
| `plan_id` | integer | - | Filter by plan ID (must exist in `plans` table) |
| `search` | string | - | Search by user name or email (max 100 chars) |
| `start_date` | date | - | Filter subscriptions created on or after this date (`Y-m-d`) |
| `end_date` | date | - | Filter subscriptions created on or before this date (`Y-m-d`). Must be >= `start_date` if both provided |
| `min_amount` | numeric | - | Filter by minimum amount (>= 0) |
| `max_amount` | numeric | - | Filter by maximum amount (>= 0). Must be >= `min_amount` if both provided |
| `sort_by` | string | `created_at` | Sort field: `created_at`, `amount`, `start_date`, `next_payment_date` |
| `sort_order` | string | `desc` | Sort direction: `asc`, `desc` |
| `per_page` | integer | `15` | Results per page (1-100) |

**Example Requests:**

```
GET /api/admin/subscriptions
GET /api/admin/subscriptions?status=active
GET /api/admin/subscriptions?search=john&sort_by=amount&sort_order=asc
GET /api/admin/subscriptions?start_date=2026-01-01&end_date=2026-03-01
GET /api/admin/subscriptions?min_amount=5000&max_amount=50000&per_page=10
```

**Example curl:**

```bash
curl -X GET "http://localhost:8000/api/admin/subscriptions?status=active&per_page=2" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200):**

```json
{
  "success": true,
  "message": "Subscriptions retrieved successfully.",
  "data": [
    {
      "id": 12,
      "subscription_code": "SUB_test_1",
      "user": {
        "uuid": "537de72f-a26e-4219-91fd-b3da3f1922a6",
        "name": "Analytics Test User 1",
        "email": "analytics-test1@test.com"
      },
      "plan": {
        "id": 19,
        "name": "Pro Monthly",
        "slug": "pro-monthly",
        "description": "For serious students, junior lawyers, and heavy research users.",
        "amount": "15000.00",
        "formatted_amount": "NGN 15,000.00",
        "currency": "NGN",
        "interval": "monthly",
        "interval_label": "Monthly",
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
      "amount": "15000.00",
      "currency": "NGN",
      "start_date": "2026-01-20T19:13:07+00:00",
      "next_payment_date": "2026-03-21T19:13:07+00:00",
      "cancelled_at": null,
      "ends_at": null,
      "days_until_renewal": 14,
      "is_in_grace_period": false,
      "has_access": true,
      "invoices_count": 2,
      "created_at": "2026-03-06T19:13:07+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 2,
    "total": 8,
    "last_page": 4,
    "from": 1,
    "to": 2
  },
  "links": {
    "first": "http://localhost:8000/api/admin/subscriptions?page=1",
    "last": "http://localhost:8000/api/admin/subscriptions?page=4",
    "prev": null,
    "next": "http://localhost:8000/api/admin/subscriptions?page=2"
  }
}
```

**Empty Results (200):**

```json
{
  "success": true,
  "message": "Subscriptions retrieved successfully.",
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
    "first": "http://localhost:8000/api/admin/subscriptions?page=1",
    "last": "http://localhost:8000/api/admin/subscriptions?page=1",
    "prev": null,
    "next": null
  }
}
```

**Notes:**
- `days_until_renewal` returns `null` for cancelled, expired, or subscriptions with no `next_payment_date`.
- `is_in_grace_period` is only `true` for `past_due` subscriptions within the configured grace period.
- `has_access` considers status + grace period + cancellation `ends_at` date.
- `start_date` and `end_date` filter on the subscription's `created_at` field.
- `start_date` and `end_date` can be used independently or together.

---

## Show Subscription

### GET /api/admin/subscriptions/{id}

Retrieve detailed information about a single subscription, including recent invoices and admin-specific fields.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Subscription ID (numeric only) |

**Example curl:**

```bash
curl -X GET "http://localhost:8000/api/admin/subscriptions/1" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200):**

```json
{
  "success": true,
  "message": "Subscription retrieved successfully.",
  "data": {
    "id": 1,
    "subscription_code": "SUB_test_annual",
    "email_token": "test_token",
    "authorization_code": null,
    "invoice_limit": 0,
    "cron_expression": null,
    "user": {
      "uuid": "a5b3e808-a3ad-4c1f-b1e7-d3af87d11536",
      "name": "Test User Updated",
      "email": "test@example.com",
      "role": "user",
      "avatar_url": null
    },
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
    "quantity": 1,
    "start_date": "2026-01-15T00:00:00+00:00",
    "next_payment_date": "2027-01-15T00:00:00+00:00",
    "cancelled_at": null,
    "ends_at": null,
    "days_until_renewal": 314,
    "is_in_grace_period": false,
    "has_access": true,
    "recent_invoices": [],
    "created_at": "2026-03-05T13:59:02+00:00",
    "updated_at": "2026-03-06T19:15:37+00:00"
  }
}
```

**Response — Not Found (404):**

```json
{
  "success": false,
  "message": "Subscription not found.",
  "errors": null
}
```

**Notes:**
- Returns up to **10 most recent invoices** ordered by creation date (newest first).
- Includes admin-specific fields not shown in the list endpoint: `email_token`, `authorization_code`, `invoice_limit`, `cron_expression`, `quantity`, `updated_at`.
- User object includes `role` and `avatar_url` (not included in list endpoint).
- Non-numeric IDs (e.g., `/subscriptions/abc`) return a route-not-found error.

---

## Cancel Subscription

### POST /api/admin/subscriptions/{id}/cancel

Cancel a user's subscription. This disables the subscription in Paystack and sets the local status to `cancelled`. The user retains access until the `ends_at` date (typically the next payment date).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Subscription ID (numeric only) |

**Example curl:**

```bash
curl -X POST "http://localhost:8000/api/admin/subscriptions/1/cancel" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response — Success (200):**

```json
{
  "success": true,
  "message": "Subscription cancelled successfully. Access continues until 2026-04-15.",
  "data": {
    "id": 1,
    "subscription_code": "SUB_test123",
    "email_token": "token_abc",
    "authorization_code": null,
    "invoice_limit": 0,
    "cron_expression": null,
    "user": {
      "uuid": "a5b3e808-a3ad-4c1f-b1e7-d3af87d11536",
      "name": "Test User",
      "email": "test@example.com",
      "role": "user",
      "avatar_url": null
    },
    "plan": { "..." : "full plan object" },
    "status": "cancelled",
    "status_label": "Cancelled",
    "amount": "15000.00",
    "currency": "NGN",
    "quantity": 1,
    "start_date": "2026-01-15T00:00:00+00:00",
    "next_payment_date": "2026-04-15T00:00:00+00:00",
    "cancelled_at": "2026-03-10T14:30:00+00:00",
    "ends_at": "2026-04-15T00:00:00+00:00",
    "days_until_renewal": null,
    "is_in_grace_period": false,
    "has_access": true,
    "recent_invoices": [],
    "created_at": "2026-01-15T00:00:00+00:00",
    "updated_at": "2026-03-10T14:30:00+00:00"
  }
}
```

**Response — Not Found (404):**

```json
{
  "success": false,
  "message": "Subscription not found.",
  "errors": null
}
```

**Response — Free Plan (400):**

```json
{
  "success": false,
  "message": "Cannot cancel a free tier subscription.",
  "errors": null
}
```

**Response — Already Cancelled (400):**

```json
{
  "success": false,
  "message": "Subscription is already cancelled. Access continues until 2026-04-15.",
  "errors": null
}
```

**Response — Already Expired (400):**

```json
{
  "success": false,
  "message": "Subscription is already expired.",
  "errors": null
}
```

**Notes:**
- Dispatches a `SubscriptionCancelled` event.
- Calls Paystack's `POST /subscription/disable` endpoint if the subscription has a `subscription_code`. Paystack failures are logged but do not prevent local cancellation.
- The user retains access until `ends_at`, which defaults to the `next_payment_date` or falls back to a grace period.
- Can cancel subscriptions with status: `active`, `past_due`, `trialing`.

---

## Reactivate Subscription

### POST /api/admin/subscriptions/{id}/reactivate

Reactivate a cancelled subscription. This re-enables the subscription in Paystack and restores the local status to `active`.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Subscription ID (numeric only) |

**Example curl:**

```bash
curl -X POST "http://localhost:8000/api/admin/subscriptions/1/reactivate" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response — Success (200):**

```json
{
  "success": true,
  "message": "Subscription reactivated successfully.",
  "data": {
    "id": 1,
    "subscription_code": "SUB_test123",
    "email_token": "token_abc",
    "authorization_code": null,
    "invoice_limit": 0,
    "cron_expression": null,
    "user": {
      "uuid": "a5b3e808-a3ad-4c1f-b1e7-d3af87d11536",
      "name": "Test User",
      "email": "test@example.com",
      "role": "user",
      "avatar_url": null
    },
    "plan": { "..." : "full plan object" },
    "status": "active",
    "status_label": "Active",
    "amount": "15000.00",
    "currency": "NGN",
    "quantity": 1,
    "start_date": "2026-01-15T00:00:00+00:00",
    "next_payment_date": "2026-04-10T14:30:00+00:00",
    "cancelled_at": null,
    "ends_at": null,
    "days_until_renewal": 31,
    "is_in_grace_period": false,
    "has_access": true,
    "recent_invoices": [],
    "created_at": "2026-01-15T00:00:00+00:00",
    "updated_at": "2026-03-10T14:30:00+00:00"
  }
}
```

**Response — Not Found (404):**

```json
{
  "success": false,
  "message": "Subscription not found.",
  "errors": null
}
```

**Response — Not Cancelled (400):**

```json
{
  "success": false,
  "message": "Only cancelled subscriptions can be reactivated. Current status: Active.",
  "errors": null
}
```

**Notes:**
- Only subscriptions with status `cancelled` can be reactivated. Expired subscriptions cannot be re-enabled in Paystack.
- Calls Paystack's `POST /subscription/enable` endpoint if the subscription has a `subscription_code`. Paystack failures are logged but do not prevent local reactivation.
- Clears `cancelled_at` and `ends_at`, sets a new `next_payment_date` based on the plan's interval.

---

## List Subscribers

### GET /api/admin/subscribers

Retrieve a paginated list of users who have subscriptions, with their most recent subscription info.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | - | Search by user name or email (max 100 chars) |
| `role` | string | - | Filter by user role: `user`, `researcher`, `admin`, `superadmin`, `guest` |
| `plan_id` | integer | - | Filter by plan ID of any of the user's subscriptions |
| `subscription_status` | string | - | Filter by subscription status: `active`, `past_due`, `cancelled`, `expired`, `trialing` |
| `sort_by` | string | `created_at` | Sort field: `name`, `email`, `created_at` |
| `sort_order` | string | `desc` | Sort direction: `asc`, `desc` |
| `per_page` | integer | `15` | Results per page (1-100) |

**Example Requests:**

```
GET /api/admin/subscribers
GET /api/admin/subscribers?role=user&subscription_status=active
GET /api/admin/subscribers?search=john&sort_by=name&sort_order=asc
GET /api/admin/subscribers?plan_id=19&per_page=10
```

**Example curl:**

```bash
curl -X GET "http://localhost:8000/api/admin/subscribers?role=user&sort_by=name&sort_order=asc" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200):**

```json
{
  "success": true,
  "message": "Subscribers retrieved successfully.",
  "data": [
    {
      "uuid": "537de72f-a26e-4219-91fd-b3da3f1922a6",
      "name": "Analytics Test User 1",
      "email": "analytics-test1@test.com",
      "role": "user",
      "avatar_url": null,
      "created_at": "2026-01-05T19:13:01+00:00",
      "subscription": {
        "id": 12,
        "status": "active",
        "status_label": "Active",
        "amount": "15000.00",
        "currency": "NGN",
        "start_date": "2026-01-20T19:13:07+00:00",
        "next_payment_date": "2026-03-21T19:13:07+00:00",
        "ends_at": null,
        "has_access": true,
        "plan": {
          "id": 19,
          "name": "Pro Monthly",
          "slug": "pro-monthly",
          "description": "For serious students, junior lawyers, and heavy research users.",
          "amount": "15000.00",
          "formatted_amount": "NGN 15,000.00",
          "currency": "NGN",
          "interval": "monthly",
          "interval_label": "Monthly",
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
        }
      }
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 8,
    "last_page": 1,
    "from": 1,
    "to": 8
  },
  "links": {
    "first": "http://localhost:8000/api/admin/subscribers?page=1",
    "last": "http://localhost:8000/api/admin/subscribers?page=1",
    "prev": null,
    "next": null
  }
}
```

**Notes:**
- Only returns users who have **at least one subscription**. Users without subscriptions are excluded.
- The `subscription` object shows the **most recent subscription** (ordered by `start_date` descending).
- `plan_id` and `subscription_status` filters match against **any** of the user's subscriptions (not just the most recent).
- If a user has multiple subscriptions, they appear once with their latest subscription shown.

---

## Data Models

### Subscription (List)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Subscription ID |
| `subscription_code` | string\|null | Paystack subscription code |
| `user` | object | `{ uuid, name, email }` |
| `plan` | object | Full plan object (see [Plan](#plan)) |
| `status` | string | One of: `active`, `past_due`, `cancelled`, `expired`, `trialing` |
| `status_label` | string | Human-readable label (e.g., "Past Due") |
| `amount` | string | Subscription amount (decimal string) |
| `currency` | string | Currency code (e.g., "NGN") |
| `start_date` | string\|null | ISO 8601 datetime |
| `next_payment_date` | string\|null | ISO 8601 datetime |
| `cancelled_at` | string\|null | ISO 8601 datetime |
| `ends_at` | string\|null | ISO 8601 datetime (access cutoff for cancelled subs) |
| `days_until_renewal` | integer\|null | Days until next payment. `null` for cancelled/expired or no next date |
| `is_in_grace_period` | boolean | `true` only for `past_due` within grace period |
| `has_access` | boolean | Whether subscription currently grants feature access |
| `invoices_count` | integer | Total number of invoices |
| `created_at` | string | ISO 8601 datetime |

### Subscription Detail

Includes all fields from [Subscription (List)](#subscription-list) plus:

| Field | Type | Description |
|-------|------|-------------|
| `email_token` | string\|null | Paystack email token |
| `authorization_code` | string\|null | Paystack authorization code |
| `invoice_limit` | integer | Invoice limit (0 = unlimited) |
| `cron_expression` | string\|null | Payment cron expression |
| `quantity` | integer | Subscription quantity |
| `user.role` | string | User role (not included in list view) |
| `user.avatar_url` | string\|null | User avatar URL (not included in list view) |
| `recent_invoices` | array | Up to 10 most recent invoices (see [Invoice](#invoice)) |
| `updated_at` | string | ISO 8601 datetime |

### Subscriber

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | string | User UUID |
| `name` | string | User name |
| `email` | string | User email |
| `role` | string | User role |
| `avatar_url` | string\|null | User avatar URL |
| `created_at` | string | ISO 8601 datetime |
| `subscription` | object\|null | Most recent subscription (see below) |
| `subscription.id` | integer | Subscription ID |
| `subscription.status` | string | Subscription status |
| `subscription.status_label` | string | Human-readable status |
| `subscription.amount` | string | Amount (decimal string) |
| `subscription.currency` | string | Currency code |
| `subscription.start_date` | string\|null | ISO 8601 datetime |
| `subscription.next_payment_date` | string\|null | ISO 8601 datetime |
| `subscription.ends_at` | string\|null | ISO 8601 datetime |
| `subscription.has_access` | boolean | Whether subscription grants access |
| `subscription.plan` | object | Full plan object |

### Plan

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Plan ID |
| `name` | string | Plan name |
| `slug` | string | URL-friendly slug |
| `description` | string | Plan description |
| `amount` | string | Plan price (decimal string) |
| `formatted_amount` | string | Formatted with currency (e.g., "NGN 15,000.00" or "Free") |
| `currency` | string | Currency code |
| `interval` | string | Billing interval: `daily`, `monthly`, `annually` |
| `interval_label` | string | Human-readable interval |
| `interval_count` | integer | Number of intervals per billing cycle |
| `is_free` | boolean | Whether this is a free plan |
| `is_featured` | boolean | Whether plan is featured |
| `features` | array | List of feature description strings |
| `limits` | array | Plan limits (see below) |

### Invoice

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Invoice ID |
| `invoice_code` | string | Paystack invoice code |
| `amount` | string | Invoice amount (decimal string) |
| `currency` | string | Currency code |
| `formatted_amount` | string | Formatted with currency |
| `status` | string | Invoice status |
| `paid` | boolean | Whether invoice has been paid |
| `paid_at` | string\|null | ISO 8601 datetime |
| `period_start` | string\|null | Period start date (`Y-m-d`) |
| `period_end` | string\|null | Period end date (`Y-m-d`) |
| `transaction_reference` | string\|null | Payment transaction reference |
| `created_at` | string | ISO 8601 datetime |

---

## Validation & Error Responses

All validation errors return **422** with the following structure:

```json
{
  "success": false,
  "message": "First error message.",
  "errors": {
    "field_name": ["Error message."]
  }
}
```

### List Subscriptions Validation

**Invalid status:**

```json
{
  "success": false,
  "message": "Status must be one of: active, past_due, cancelled, expired, trialing.",
  "errors": {
    "status": ["Status must be one of: active, past_due, cancelled, expired, trialing."]
  }
}
```

**Invalid sort_by:**

```json
{
  "success": false,
  "message": "Sort by must be one of: created_at, amount, start_date, next_payment_date.",
  "errors": {
    "sort_by": ["Sort by must be one of: created_at, amount, start_date, next_payment_date."]
  }
}
```

**per_page out of range:**

```json
{
  "success": false,
  "message": "The per page field must not be greater than 100.",
  "errors": {
    "per_page": ["The per page field must not be greater than 100."]
  }
}
```

**end_date before start_date:**

```json
{
  "success": false,
  "message": "End date must be after or equal to start date.",
  "errors": {
    "end_date": ["End date must be after or equal to start date."]
  }
}
```

**max_amount less than min_amount:**

```json
{
  "success": false,
  "message": "Max amount must be greater than or equal to min amount.",
  "errors": {
    "max_amount": ["Max amount must be greater than or equal to min amount."]
  }
}
```

### List Subscribers Validation

**Invalid role:**

```json
{
  "success": false,
  "message": "Role must be one of: user, researcher, admin, superadmin, guest.",
  "errors": {
    "role": ["Role must be one of: user, researcher, admin, superadmin, guest."]
  }
}
```

**Invalid subscription_status:**

```json
{
  "success": false,
  "message": "Subscription status must be one of: active, past_due, cancelled, expired, trialing.",
  "errors": {
    "subscription_status": ["Subscription status must be one of: active, past_due, cancelled, expired, trialing."]
  }
}
```

---

## Subscription Status Reference

| Status | Label | Has Access | Description |
|--------|-------|------------|-------------|
| `active` | Active | Yes | Subscription is current and paid |
| `past_due` | Past Due | Yes (grace period) | Payment failed, within grace period |
| `cancelled` | Cancelled | Until `ends_at` | User cancelled, access until period end |
| `expired` | Expired | No | Subscription fully ended |
| `trialing` | Trialing | Yes | In trial period |

---

## Implementation Files

| File | Description |
|------|-------------|
| `app/Http/Controllers/Admin/SubscriptionController.php` | Controller with `index`, `show`, `cancel`, `reactivate`, `subscribers` actions |
| `app/Http/Requests/Admin/ListSubscriptionsRequest.php` | Validation for list subscriptions |
| `app/Http/Requests/Admin/ListSubscribersRequest.php` | Validation for list subscribers |
| `app/Http/Resources/Admin/SubscriptionResource.php` | List item resource |
| `app/Http/Resources/Admin/SubscriptionDetailResource.php` | Detail view resource |
| `app/Http/Resources/Admin/SubscriberResource.php` | Subscriber resource |
| `app/Http/Resources/Admin/SubscriptionInvoiceResource.php` | Invoice resource |
| `app/Services/SubscriptionService.php` | Service with `cancel()`, `reactivate()` methods (handles Paystack + events) |
| `app/Models/Subscription.php` | Model with `days_until_renewal`, `is_in_grace_period`, `hasAccess()` |
| `routes/api.php` | Route definitions (lines 596-602) |
| `tests/Feature/Admin/SubscriptionManagementTest.php` | Feature tests (72 tests) |
