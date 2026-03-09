# PAYG Message Packs API - Frontend Reference

## Overview

The PAYG (Pay-As-You-Go) message pack system allows users to purchase additional AI messages beyond their plan limit. Each pack costs N2,000 and provides 10 AI messages. Messages do not expire and are consumed FIFO (oldest pack first). Plan messages are always consumed before PAYG messages.

**Key Features:**
- Purchase 1-10 message packs per transaction via Paystack
- PAYG balance persists across billing periods (never expires)
- Plan messages consumed first, PAYG only when plan is exhausted
- FIFO consumption across packs (oldest pack first)
- Idempotent verification (safe to call verify multiple times)
- Webhook-driven backup verification for payment reliability
- Receipt email sent automatically after purchase

**Payment Provider:** [Paystack](https://paystack.com) — all transactions are processed through Paystack's hosted payment page.

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Endpoints](#endpoints)
   - [List Message Packs](#get-apimessage-packs)
   - [Get PAYG Balance](#get-apimessage-packsbalance)
   - [Purchase Message Pack](#post-apimessage-packspurchase)
   - [Verify Payment](#get-apimessage-packsverifyreference)
3. [PAYG Balance in Limits API](#payg-balance-in-limits-api)
4. [Webhook](#webhook)
5. [Purchase Flow](#purchase-flow)
6. [Data Models](#data-models)
7. [Pricing Reference](#pricing-reference)
8. [Validation & Error Responses](#validation--error-responses)
9. [Frontend Integration Guide](#frontend-integration-guide)

---

## Authentication & Authorization

| Endpoint | Method | Auth Required | Role Required | Rate Limit |
|----------|--------|---------------|---------------|------------|
| `/api/message-packs` | GET | Yes | Any | Default |
| `/api/message-packs/balance` | GET | Yes | Any | Default |
| `/api/message-packs/purchase` | POST | Yes | Any | 5/min |
| `/api/message-packs/verify/{reference}` | GET | Yes | Any | 10/min |

All endpoints use Bearer token authentication via `Authorization: Bearer {token}`.

**Unauthenticated (401):**

```json
{
  "success": false,
  "message": "Unauthenticated.",
  "errors": null
}
```

**Rate Limited (429):**

```json
{
  "success": false,
  "message": "Too many requests. Please try again later.",
  "errors": null
}
```

---

## Endpoints

### GET /api/message-packs

Returns the authenticated user's message packs, ordered newest first. Users can only see their own packs. Optionally filter by status.

**Example Request:**

```bash
curl -X GET "http://localhost:8000/api/message-packs?status=completed&per_page=15" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | *(none)* | Filter by status: `pending`, `completed`, `failed`, `refunded`. Invalid values are ignored (returns all). |
| `per_page` | integer | 15 | Items per page (clamped to 1-100) |
| `page` | integer | 1 | Page number |

**Response (200):**

```json
{
  "success": true,
  "message": "Message packs retrieved successfully.",
  "data": [
    {
      "id": 13,
      "quantity": 2,
      "messages_total": 20,
      "messages_remaining": 15,
      "amount": "4000.00",
      "formatted_amount": "₦4,000.00",
      "currency": "NGN",
      "status": "completed",
      "status_label": "Completed",
      "paid_at": "2026-03-08T03:32:34+00:00",
      "created_at": "2026-03-08T03:32:34+00:00"
    },
    {
      "id": 14,
      "quantity": 1,
      "messages_total": 10,
      "messages_remaining": 10,
      "amount": "2000.00",
      "formatted_amount": "₦2,000.00",
      "currency": "NGN",
      "status": "completed",
      "status_label": "Completed",
      "paid_at": "2026-03-08T03:32:34+00:00",
      "created_at": "2026-03-08T03:32:34+00:00"
    },
    {
      "id": 15,
      "quantity": 3,
      "messages_total": 30,
      "messages_remaining": 0,
      "amount": "6000.00",
      "formatted_amount": "₦6,000.00",
      "currency": "NGN",
      "status": "pending",
      "status_label": "Pending",
      "paid_at": null,
      "created_at": "2026-03-08T03:32:34+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 3,
    "last_page": 1,
    "from": 1,
    "to": 3
  },
  "links": {
    "first": "http://localhost:8000/api/message-packs?page=1",
    "last": "http://localhost:8000/api/message-packs?page=1",
    "prev": null,
    "next": null
  }
}
```

**Empty Response (200):**

```json
{
  "success": true,
  "message": "Message packs retrieved successfully.",
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
    "first": "http://localhost:8000/api/message-packs?page=1",
    "last": "http://localhost:8000/api/message-packs?page=1",
    "prev": null,
    "next": null
  }
}
```

**Notes:**
- The `per_page` parameter is clamped: values below 1 become 1, values above 100 become 100, non-numeric values become 1.
- All statuses are returned (pending, completed, failed, refunded) — the frontend can filter as needed.
- Packs are scoped to the authenticated user; no cross-user data is ever exposed.

---

### GET /api/message-packs/balance

Returns the total remaining PAYG messages across all completed packs. Pending and failed packs are excluded.

**Example Request:**

```bash
curl -X GET "http://localhost:8000/api/message-packs/balance" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200):**

```json
{
  "success": true,
  "message": "PAYG balance retrieved successfully.",
  "data": {
    "payg_remaining": 25
  }
}
```

**Response (200) — No packs:**

```json
{
  "success": true,
  "message": "PAYG balance retrieved successfully.",
  "data": {
    "payg_remaining": 0
  }
}
```

**Notes:**
- Only counts `messages_remaining` from completed packs.
- This is a lightweight endpoint suitable for polling or displaying in the UI header.

---

### POST /api/message-packs/purchase

Initializes a Paystack payment for a message pack purchase. Returns an authorization URL to redirect the user to Paystack's checkout page.

**Rate limit:** 5 requests per minute.

**Example Request:**

```bash
curl -X POST "http://localhost:8000/api/message-packs/purchase" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 5, "callback_url": "https://app.example.com/payg/callback"}'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `quantity` | integer | Yes | Number of packs to purchase (1-10) |
| `callback_url` | string | No | URL Paystack redirects to after payment. Frontend should always provide this. |

**Response (200):**

```json
{
  "success": true,
  "message": "Payment initialized. Redirect user to authorization URL.",
  "data": {
    "authorization_url": "https://checkout.paystack.com/abc123",
    "access_code": "ACCESS_abc123",
    "reference": "msgpack_2_1709859600_aB3cD4eF",
    "quantity": 5,
    "messages": 50,
    "amount": 10000,
    "currency": "NGN"
  }
}
```

**Validation Errors (422):**

```json
{
  "success": false,
  "message": "You must purchase at least 1 pack.",
  "errors": {
    "quantity": ["You must purchase at least 1 pack."]
  }
}
```

| Validation Rule | Error Message |
|----------------|---------------|
| `quantity` missing | "Please specify the number of packs to purchase." |
| `quantity` < 1 | "You must purchase at least 1 pack." |
| `quantity` > 10 | "You can purchase a maximum of 10 packs per transaction." |
| `quantity` not integer | "The quantity field must be an integer." |
| `callback_url` invalid | "The callback url field must be a valid URL." |

**Error (500) — Payment gateway failure:**

```json
{
  "success": false,
  "message": "An unexpected error occurred. Please try again.",
  "errors": null
}
```

**Notes:**
- The `callback_url` should point to a frontend page that calls the verify endpoint. If omitted, the default points to the API verify endpoint (which returns JSON, not a rendered page).
- The `reference` returned should be stored by the frontend to call verify after Paystack redirect.
- A pending `MessagePack` record is created immediately. If the user abandons payment, it remains pending.

---

### GET /api/message-packs/verify/{reference}

Verifies a Paystack payment and completes the purchase. The reference must belong to the authenticated user. This endpoint is idempotent — calling it multiple times for a completed pack returns success without side effects.

**Rate limit:** 10 requests per minute.

**Example Request:**

```bash
curl -X GET "http://localhost:8000/api/message-packs/verify/msgpack_2_1709859600_aB3cD4eF" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `reference` | string | The transaction reference from the purchase response |

**Response (200) — First verification:**

```json
{
  "success": true,
  "message": "Payment verified. 50 AI messages have been credited to your account.",
  "data": {
    "id": 5,
    "quantity": 5,
    "messages_total": 50,
    "messages_remaining": 50,
    "amount": "10000.00",
    "formatted_amount": "₦10,000.00",
    "currency": "NGN",
    "status": "completed",
    "status_label": "Completed",
    "paid_at": "2026-03-08T03:15:00+00:00",
    "created_at": "2026-03-08T03:14:30+00:00"
  }
}
```

**Response (200) — Idempotent re-verification:**

```json
{
  "success": true,
  "message": "Purchase already completed.",
  "data": {
    "id": 5,
    "quantity": 5,
    "messages_total": 50,
    "messages_remaining": 48,
    "amount": "10000.00",
    "formatted_amount": "₦10,000.00",
    "currency": "NGN",
    "status": "completed",
    "status_label": "Completed",
    "paid_at": "2026-03-08T03:15:00+00:00",
    "created_at": "2026-03-08T03:14:30+00:00"
  }
}
```

**Error (400) — Reference not found:**

```json
{
  "success": false,
  "message": "Message pack purchase not found.",
  "errors": null
}
```

**Error (400) — Belongs to another user:**

```json
{
  "success": false,
  "message": "Payment reference does not belong to this user.",
  "errors": null
}
```

**Error (400) — Payment failed at Paystack:**

```json
{
  "success": false,
  "message": "Payment verification failed.",
  "errors": null
}
```

**Error (400) — Underpayment detected:**

```json
{
  "success": false,
  "message": "Payment amount is less than expected. Please contact support.",
  "errors": null
}
```

**Notes:**
- Uses row-level locking to prevent race conditions between verify and webhook.
- Underpayment is blocked and the pack is marked as failed. Overpayment is accepted with a server-side warning log.
- The `messages_remaining` field in re-verification responses reflects actual current balance (may be less than `messages_total` if some were consumed).

---

## PAYG Balance in Limits API

The PAYG balance is also included in the user limits endpoint, alongside plan limits:

```
GET /api/users/limits
```

**Example Request:**

```bash
curl -X GET "http://localhost:8000/api/users/limits" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200):**

```json
{
  "success": true,
  "message": "Limits retrieved successfully.",
  "data": {
    "note_creations": {
      "limit_type": "note_creation",
      "plan_limit": null,
      "hard_limit": 999,
      "used": 217,
      "remaining": 782,
      "resets_at": "2026-03-15T00:00:00+00:00"
    },
    "bookmarks": {
      "limit_type": "bookmarks",
      "plan_limit": null,
      "hard_limit": null,
      "used": 1,
      "remaining": null,
      "resets_at": "2026-03-15T00:00:00+00:00"
    },
    "ai_messages": {
      "limit_type": "ai_messages",
      "plan_limit": 50,
      "hard_limit": null,
      "used": 50,
      "remaining": 0,
      "resets_at": "2026-03-15T00:00:00+00:00",
      "payg_remaining": 7,
      "total_remaining": 7
    }
  }
}
```

**AI Messages Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `remaining` | integer\|null | Plan messages remaining (resets at `resets_at`). `null` if unlimited. |
| `payg_remaining` | integer | PAYG messages remaining (never expires) |
| `total_remaining` | integer\|null | `remaining + payg_remaining`. `null` if plan is unlimited. |

**Notes:**
- Use `total_remaining` to show the user their overall message budget.
- When `remaining` is 0 but `total_remaining` > 0, the user is consuming PAYG messages.
- When both are 0, the user should be prompted to purchase a message pack or upgrade their plan.

---

## Webhook

The Paystack webhook handler at `POST /api/webhooks/paystack` automatically processes `charge.success` events for message packs when the reference starts with `msgpack_`. No client action is needed — this is a server-to-server flow.

**Webhook behavior:**
- Looks up the pack by `transaction_reference` with row-level locking
- Idempotent: skips if already completed
- Validates payment amount — blocks underpayment, allows overpayment
- Marks pack as completed, sets `messages_remaining = messages_total`
- Updates user's `customer_code` if not set
- Dispatches `MessagePackPurchased` event (sends receipt email)

**Race condition safety:** Both verify and webhook use `lockForUpdate()` to prevent duplicate processing. If both fire simultaneously for the same reference, only one completes the pack.

---

## Purchase Flow

```
1. Client → POST /api/message-packs/purchase { quantity: 3 }
2. Server creates pending MessagePack record
3. Server initializes Paystack transaction
4. Server returns authorization_url to client
5. Client redirects user to authorization_url
6. User completes payment on Paystack checkout
7. Paystack redirects to callback_url with reference
8. Client → GET /api/message-packs/verify/{reference}
9. Server verifies with Paystack API, marks pack completed
10. Server returns completed pack with credited messages

(In parallel) Paystack → POST /api/webhooks/paystack (charge.success)
→ Server processes webhook as a backup verification path
```

**Message Consumption Flow:**

```
1. User sends chat message
2. Server checks: does user have plan messages remaining?
   a. YES → message allowed, no PAYG consumed
   b. NO → consume 1 PAYG message from oldest completed pack
      - If PAYG available → message allowed
      - If no PAYG balance → 403 "You have no AI messages remaining..."
```

---

## Data Models

### MessagePackResource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Primary key |
| `quantity` | integer | Number of packs purchased |
| `messages_total` | integer | Total messages in this purchase (`quantity * 10`) |
| `messages_remaining` | integer | Messages not yet consumed |
| `amount` | string | Decimal amount (e.g., `"2000.00"`) |
| `formatted_amount` | string | Display amount with currency symbol (e.g., `"₦2,000.00"`) |
| `currency` | string | Currency code (e.g., `"NGN"`) |
| `status` | string | Status value: `pending`, `completed`, `failed`, `refunded` |
| `status_label` | string | Human-readable status (e.g., `"Completed"`) |
| `paid_at` | datetime\|null | ISO 8601 timestamp when payment was confirmed. `null` for pending/failed. |
| `created_at` | datetime | ISO 8601 timestamp when the purchase was initiated |

### Status Reference

| Status | Value | Description |
|--------|-------|-------------|
| Pending | `pending` | Payment initiated but not yet confirmed |
| Completed | `completed` | Payment verified, messages credited |
| Failed | `failed` | Payment verification failed or underpayment detected |
| Refunded | `refunded` | Payment was refunded |

---

## Pricing Reference

| Quantity | Price (NGN) | Messages | Paystack Amount (kobo) |
|----------|------------|----------|----------------------|
| 1 | 2,000 | 10 | 200,000 |
| 2 | 4,000 | 20 | 400,000 |
| 3 | 6,000 | 30 | 600,000 |
| 5 | 10,000 | 50 | 1,000,000 |
| 10 | 20,000 | 100 | 2,000,000 |

**Formula:** `price = quantity * 2000 NGN`, `messages = quantity * 10`

---

## Validation & Error Responses

### Purchase Validation

| Rule | Error Message |
|------|---------------|
| `quantity` missing | "Please specify the number of packs to purchase." |
| `quantity` not integer | "The quantity field must be an integer." |
| `quantity` < 1 | "You must purchase at least 1 pack." |
| `quantity` > 10 | "You can purchase a maximum of 10 packs per transaction." |
| `callback_url` invalid | "The callback url field must be a valid URL." |

### Error Codes

| HTTP Code | Scenario |
|-----------|----------|
| 200 | Success (pack data, balance, list) |
| 400 | Invalid reference, payment failed, ownership mismatch, underpayment |
| 401 | Not authenticated |
| 422 | Validation error (invalid quantity, invalid URL) |
| 429 | Rate limit exceeded |
| 500 | Payment gateway error |

---

## Frontend Integration Guide

### React/Next.js Example

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

// Purchase message pack
async function purchaseMessagePack(token: string, quantity: number) {
  const response = await fetch(`${API_BASE}/api/message-packs/purchase`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      quantity,
      callback_url: `${window.location.origin}/payg/callback`,
    }),
  });

  const data = await response.json();

  if (data.success) {
    // Store reference for verification after redirect
    sessionStorage.setItem('payg_reference', data.data.reference);
    // Redirect to Paystack checkout
    window.location.href = data.data.authorization_url;
  }

  return data;
}

// Verify payment (call on callback page)
async function verifyPayment(token: string, reference: string) {
  const response = await fetch(`${API_BASE}/api/message-packs/verify/${reference}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  return response.json();
}

// Get PAYG balance
async function getPaygBalance(token: string) {
  const response = await fetch(`${API_BASE}/api/message-packs/balance`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  return response.json();
}
```

### Callback Page Best Practices

1. **Always provide `callback_url`**: Point it to a frontend page (e.g., `/payg/callback`) that extracts the `reference` from the URL or session storage and calls the verify endpoint.
2. **Handle all verify outcomes**: Show success message with credited messages, or error message prompting the user to retry or contact support.
3. **Poll balance after purchase**: After successful verification, refresh the user's balance display and limits status.
4. **Show PAYG indicator**: When `remaining` is 0 but `total_remaining` > 0 in the limits API, indicate to the user that they are consuming PAYG messages.
5. **Prompt on exhaustion**: When `total_remaining` reaches 0, show a prompt to purchase more packs or upgrade their plan.
