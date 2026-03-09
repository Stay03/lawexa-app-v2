# PAYG Message Packs API

Base URL: `/api/message-packs`
Authentication: Bearer token (`auth:sanctum`) required on all endpoints.

## Overview

Users can purchase message packs to get additional AI messages beyond their plan limit. Each pack costs N2,000 and provides 10 AI messages. Messages do not expire and are consumed FIFO (oldest pack first). Plan messages are always consumed before PAYG messages.

**Key Features:**
- Purchase 1-10 message packs per transaction via Paystack
- PAYG balance persists across billing periods (never expires)
- Plan messages consumed first, PAYG only when plan is exhausted
- FIFO consumption across packs (oldest pack first)
- Idempotent verification (safe to call verify multiple times)
- Webhook-driven backup verification for payment reliability
- Receipt email sent automatically after purchase

**Webhook event**: `charge.success` — routed by `msgpack_` prefix in the transaction reference.

---

## Authentication & Rate Limits

| Endpoint | Method | Rate Limit |
|----------|--------|------------|
| `/api/message-packs` | GET | Default |
| `/api/message-packs/balance` | GET | Default |
| `/api/message-packs/purchase` | POST | 5/min |
| `/api/message-packs/verify/{reference}` | GET | 10/min |

All endpoints use Bearer token authentication via `Authorization: Bearer {token}`.

---

## Endpoints

### 1. List Message Packs

```
GET /api/message-packs
```

Returns the authenticated user's message packs (all statuses), ordered newest first.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `per_page` | integer | 15 | Items per page (clamped to 1-100) |
| `page` | integer | 1 | Page number |
| `status` | string | — | Filter by status: `pending`, `completed`, `failed`, `refunded`. Returns 422 if invalid. |

**Response** `200 OK`:

```json
{
  "success": true,
  "message": "Message packs retrieved successfully.",
  "data": [
    {
      "id": 5,
      "quantity": 1,
      "messages_total": 10,
      "messages_remaining": 5,
      "amount": 2000,
      "formatted_amount": "₦2,000.00",
      "currency": "NGN",
      "status": "completed",
      "status_label": "Completed",
      "paid_at": "2026-03-05T02:57:31+00:00",
      "created_at": "2026-03-08T02:57:31+00:00"
    },
    {
      "id": 6,
      "quantity": 2,
      "messages_total": 20,
      "messages_remaining": 0,
      "amount": 4000,
      "formatted_amount": "₦4,000.00",
      "currency": "NGN",
      "status": "pending",
      "status_label": "Pending",
      "paid_at": null,
      "created_at": "2026-03-08T02:57:31+00:00"
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
    "first": "http://localhost:8000/api/message-packs?page=1",
    "last": "http://localhost:8000/api/message-packs?page=1",
    "prev": null,
    "next": null
  }
}
```

**Statuses:** `pending`, `completed`, `failed`, `refunded`

---

### 2. Get PAYG Balance

```
GET /api/message-packs/balance
```

Returns the total remaining PAYG messages across all completed packs.

**Response** `200 OK`:

```json
{
  "success": true,
  "message": "PAYG balance retrieved successfully.",
  "data": {
    "payg_remaining": 15
  }
}
```

---

### 3. Purchase Message Pack

```
POST /api/message-packs/purchase
```

Initializes a Paystack payment for a message pack purchase.

**Rate limit:** 5 requests per minute.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `quantity` | integer | Yes | Number of packs to purchase (1-10) |
| `callback_url` | string | No | Custom callback URL after payment |

**Request Example:**

```json
{
  "quantity": 5,
  "callback_url": "https://app.example.com/payg/callback"
}
```

**Response** `200 OK`:

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

**Validation Errors** `422`:

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

**Error** `500` (payment gateway failure):

```json
{
  "success": false,
  "message": "An unexpected error occurred. Please try again.",
  "errors": null
}
```

---

### 4. Verify Payment

```
GET /api/message-packs/verify/{reference}
```

Verifies a Paystack payment and completes the purchase. The reference must belong to the authenticated user.

**Rate limit:** 10 requests per minute.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `reference` | string | The transaction reference from the purchase response |

**Response** `200 OK` (first verification):

```json
{
  "success": true,
  "message": "Payment verified. 50 AI messages have been credited to your account.",
  "data": {
    "id": 5,
    "quantity": 5,
    "messages_total": 50,
    "messages_remaining": 50,
    "amount": 10000,
    "formatted_amount": "₦10,000.00",
    "currency": "NGN",
    "status": "completed",
    "status_label": "Completed",
    "paid_at": "2026-03-08T03:15:00+00:00",
    "created_at": "2026-03-08T03:14:30+00:00"
  }
}
```

**Response** `200 OK` (idempotent re-verification):

```json
{
  "success": true,
  "message": "Purchase already completed.",
  "data": {
    "id": 5,
    "quantity": 5,
    "messages_total": 50,
    "messages_remaining": 48,
    "amount": 10000,
    "formatted_amount": "₦10,000.00",
    "currency": "NGN",
    "status": "completed",
    "status_label": "Completed",
    "paid_at": "2026-03-08T03:15:00+00:00",
    "created_at": "2026-03-08T03:14:30+00:00"
  }
}
```

**Error** `400` (reference not found):

```json
{
  "success": false,
  "message": "Message pack purchase not found.",
  "errors": null
}
```

**Error** `400` (belongs to another user):

```json
{
  "success": false,
  "message": "Payment reference does not belong to this user.",
  "errors": null
}
```

**Error** `400` (payment failed at Paystack):

```json
{
  "success": false,
  "message": "Payment verification failed.",
  "errors": null
}
```

**Error** `400` (underpayment detected):

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

## PAYG Balance in Limits API

The PAYG balance is also available in the user limits endpoint:

```
GET /api/users/limits
```

```json
{
  "success": true,
  "message": "Limits retrieved successfully.",
  "data": {
    "ai_messages": {
      "limit_type": "ai_messages",
      "plan_limit": 50,
      "hard_limit": null,
      "used": 50,
      "remaining": 0,
      "resets_at": "2026-03-15T00:00:00+00:00",
      "payg_remaining": 15,
      "total_remaining": 15
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `remaining` | Plan messages remaining (resets at `resets_at`) |
| `payg_remaining` | PAYG messages remaining (never expires) |
| `total_remaining` | `remaining + payg_remaining` (null if plan is unlimited) |

---

## Pricing Reference

| Quantity | Price (NGN) | Messages | Paystack Amount (kobo) |
|----------|------------|----------|----------------------|
| 1 | 2,000 | 10 | 200,000 |
| 2 | 4,000 | 20 | 400,000 |
| 5 | 10,000 | 50 | 1,000,000 |
| 10 | 20,000 | 100 | 2,000,000 |

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
| `amount` | integer | Amount in naira (e.g., `2000`) |
| `formatted_amount` | string | Display amount with currency symbol (e.g., `"₦2,000.00"`) |
| `currency` | string | Currency code (e.g., `"NGN"`) |
| `status` | string | Status value: `pending`, `completed`, `failed`, `refunded` |
| `status_label` | string | Human-readable status (e.g., `"Completed"`) |
| `paid_at` | datetime\|null | ISO 8601 timestamp when payment was confirmed. `null` for pending/failed. |
| `created_at` | datetime | ISO 8601 timestamp when the purchase was initiated |

---

## Error Codes

| HTTP Code | Scenario |
|-----------|----------|
| 200 | Success |
| 400 | Invalid reference, payment failed, ownership mismatch, underpayment |
| 401 | Not authenticated |
| 422 | Validation error (invalid quantity, invalid URL, invalid status filter) |
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
