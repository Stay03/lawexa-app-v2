# Phase 2: Authentication API Documentation

Base URL: `/api/auth`

## Overview

The authentication system supports multiple authentication methods:
- Email/password registration and login
- Google OAuth 2.0
- Guest tokens for anonymous access

All authenticated endpoints require a Bearer token in the `Authorization` header.

---

## Public Endpoints

### Register

Create a new user account with email and password.

```
POST /api/auth/register
```

**Rate Limit:** 10 requests/minute

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | User's display name (max 255 chars) |
| email | string | Yes | Valid email address (unique) |
| password | string | Yes | Minimum 8 characters |
| password_confirmation | string | Yes | Must match password |

**Example Request:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123",
  "password_confirmation": "securepassword123"
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Registration successful. Please verify your email.",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "is_creator": null,
      "is_verified": false,
      "auth_provider": "email",
      "avatar_url": null,
      "profile": null,
      "created_at": "2026-01-08T12:00:00.000000Z"
    },
    "token": "1|abc123..."
  }
}
```

**Error Responses:**

- `422 Unprocessable Entity` - Validation errors
  ```json
  {
    "success": false,
    "message": "This email address is already registered.",
    "errors": {
      "email": ["This email address is already registered."]
    }
  }
  ```

---

### Login

Authenticate with email and password.

```
POST /api/auth/login
```

**Rate Limit:** 5 requests/minute

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Registered email address |
| password | string | Yes | Account password |

**Example Request:**

```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "is_creator": false,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "profile": null,
      "created_at": "2026-01-08T12:00:00.000000Z"
    },
    "token": "2|xyz789..."
  }
}
```

**Error Responses:**

- `401 Unauthorized` - Invalid credentials
  ```json
  {
    "success": false,
    "message": "Invalid credentials.",
    "errors": null
  }
  ```

- `429 Too Many Requests` - Rate limit exceeded

---

### Google OAuth - Redirect

Get the Google OAuth redirect URL.

```
GET /api/auth/google
```

**Rate Limit:** 10 requests/minute

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Redirect to Google for authentication.",
  "data": {
    "url": "https://accounts.google.com/o/oauth2/auth?..."
  }
}
```

---

### Google OAuth - Callback

Exchange Google access token for application token.

```
POST /api/auth/google
```

**Rate Limit:** 10 requests/minute

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| access_token | string | Yes | Google OAuth access token |

**Example Request:**

```json
{
  "access_token": "ya29.a0AfH6SM..."
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "is_creator": false,
      "is_verified": true,
      "auth_provider": "google",
      "avatar_url": "https://lh3.googleusercontent.com/...",
      "profile": null,
      "created_at": "2026-01-08T12:00:00.000000Z"
    },
    "token": "3|def456..."
  }
}
```

**Notes:**
- New users are automatically created if the email doesn't exist
- Email is automatically verified for Google OAuth users
- Avatar URL is imported from Google profile

---

### Guest Token

Generate a token for anonymous/guest access.

```
POST /api/auth/guest
```

**Rate Limit:** 30 requests/minute

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| fingerprint | string | No | Client fingerprint for returning guests (max 100 chars) |

**Example Request:**

```json
{
  "fingerprint": "abc123def456"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Guest token created.",
  "data": {
    "user": {
      "id": 5,
      "name": "Guest User",
      "email": null,
      "role": "guest",
      "is_creator": null,
      "is_verified": false,
      "auth_provider": "email",
      "avatar_url": null,
      "created_at": "2026-01-08T12:00:00.000000Z"
    },
    "token": "4|ghi789..."
  }
}
```

**Notes:**
- If a fingerprint is provided and matches an existing guest, the same user is returned with a new token
- Guest tokens expire after 24 hours (configurable via `LAWEXA_GUEST_TOKEN_EXPIRY`)
- Guests have limited access compared to registered users

---

### Forgot Password

Request a password reset link.

```
POST /api/auth/forgot-password
```

**Rate Limit:** 3 requests/minute

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Registered email address |

**Example Request:**

```json
{
  "email": "john@example.com"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Password reset link sent to your email.",
  "data": null
}
```

**Error Responses:**

- `400 Bad Request` - Unable to send reset link
  ```json
  {
    "success": false,
    "message": "Unable to send password reset link. Please try again.",
    "errors": null
  }
  ```

**Notes:**
- For security, the same success message is returned whether or not the email exists
- Reset link format: `{FRONTEND_URL}/reset-password?token={token}&email={email}`

---

### Reset Password

Reset password using the token from the email.

```
POST /api/auth/reset-password
```

**Rate Limit:** 3 requests/minute

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| token | string | Yes | Reset token from email |
| email | string | Yes | Email address |
| password | string | Yes | New password (min 8 chars) |
| password_confirmation | string | Yes | Must match password |

**Example Request:**

```json
{
  "token": "e08c923045f5f3027ab84f4af7e5e894fa517ace228f2c9c930a8e68f8b0955b",
  "email": "john@example.com",
  "password": "newsecurepassword",
  "password_confirmation": "newsecurepassword"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Password has been reset successfully.",
  "data": null
}
```

**Error Responses:**

- `400 Bad Request` - Invalid or expired token
  ```json
  {
    "success": false,
    "message": "Invalid or expired reset token.",
    "errors": null
  }
  ```

---

### Verify Email

Verify email address using the signed URL from email.

```
GET /api/auth/verify-email/{id}/{hash}
```

**Middleware:** `signed` (Laravel signed URL verification)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | integer | User ID |
| hash | string | Verification hash |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| expires | integer | URL expiration timestamp |
| signature | string | Laravel signature |

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Email verified successfully.",
  "data": null
}
```

**Error Responses:**

- `400 Bad Request` - Email already verified
- `403 Forbidden` - Invalid signature

---

## Protected Endpoints

All endpoints below require authentication via Bearer token:

```
Authorization: Bearer {token}
```

---

### Get Current User

Retrieve the authenticated user's information.

```
GET /api/auth/me
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "is_creator": false,
    "is_verified": true,
    "auth_provider": "email",
    "avatar_url": null,
    "profile": {
      "gender": "male",
      "date_of_birth": "1990-01-15",
      "profession": "Lawyer",
      "law_school": "University of Lagos",
      "year_of_call": 2015,
      "bio": "Experienced corporate lawyer..."
    },
    "areas_of_expertise": [
      {"id": 1, "name": "Corporate Law", "slug": "corporate-law"},
      {"id": 2, "name": "Tax Law", "slug": "tax-law"}
    ],
    "created_at": "2026-01-08T12:00:00.000000Z"
  }
}
```

**Error Responses:**

- `401 Unauthorized` - Invalid or missing token

---

### Logout

Invalidate the current access token.

```
POST /api/auth/logout
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Logged out successfully.",
  "data": null
}
```

---

### Resend Verification Email

Request a new email verification link.

```
POST /api/auth/resend-verification
```

**Rate Limit:** 3 requests/minute

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Verification email sent.",
  "data": null
}
```

**Error Responses:**

- `400 Bad Request` - Email already verified
  ```json
  {
    "success": false,
    "message": "Email already verified.",
    "errors": null
  }
  ```

---

### List Sessions

Get all active sessions for the authenticated user.

```
GET /api/auth/sessions
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Sessions retrieved successfully.",
  "data": [
    {
      "id": 1,
      "name": "Chrome",
      "device": {
        "name": "Chrome on Windows",
        "type": "desktop",
        "browser": "Chrome",
        "platform": "Windows",
        "location": "Lagos, Nigeria",
        "ip_address": "102.89.23.45"
      },
      "last_used_at": "2026-01-08T14:30:00.000000Z",
      "created_at": "2026-01-08T12:00:00.000000Z",
      "is_current": true
    },
    {
      "id": 2,
      "name": "Safari",
      "device": {
        "name": "Safari on iPhone",
        "type": "phone",
        "browser": "Safari",
        "platform": "iOS",
        "location": "Abuja, Nigeria",
        "ip_address": "102.89.45.67"
      },
      "last_used_at": "2026-01-08T10:15:00.000000Z",
      "created_at": "2026-01-07T08:00:00.000000Z",
      "is_current": false
    }
  ]
}
```

---

### Revoke Session

Revoke a specific session by ID.

```
DELETE /api/auth/sessions/{id}
```

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | integer | Session/token ID |

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Session revoked successfully.",
  "data": null
}
```

**Error Responses:**

- `400 Bad Request` - Cannot revoke current session
  ```json
  {
    "success": false,
    "message": "Cannot revoke current session. Use logout instead.",
    "errors": null
  }
  ```

- `404 Not Found` - Session not found
  ```json
  {
    "success": false,
    "message": "Session not found.",
    "errors": null
  }
  ```

---

### Revoke All Sessions

Revoke all sessions except the current one.

```
DELETE /api/auth/sessions
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "All other sessions have been revoked.",
  "data": null
}
```

---

## User Roles

| Role | Value | Priority | Description |
|------|-------|----------|-------------|
| Superadmin | `superadmin` | 100 | Full system access |
| Admin | `admin` | 80 | Administrative access |
| Researcher | `researcher` | 60 | Can create and manage legal cases |
| User | `user` | 40 | Standard registered user |
| Guest | `guest` | 20 | Anonymous/temporary access |
| Bot | `bot` | 10 | Automated system user |

---

## Authentication Providers

| Provider | Value | Description |
|----------|-------|-------------|
| Email | `email` | Traditional email/password |
| Google | `google` | Google OAuth 2.0 |

---

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "errors": null
}
```

For validation errors (422):

```json
{
  "success": false,
  "message": "First error message (and N more errors)",
  "errors": {
    "field1": ["Error 1", "Error 2"],
    "field2": ["Error 3"]
  }
}
```

---

## Rate Limiting

Rate limits are applied per IP address. When exceeded, you'll receive:

```
HTTP 429 Too Many Requests
```

```json
{
  "message": "Too Many Attempts."
}
```

Response headers include:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `Retry-After`: Seconds until rate limit resets

---

## Bot Detection

All API endpoints include bot detection middleware. Detected bots receive:
- Lower rate limits
- Request attributes `is_bot` and `bot_name` are set

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | - | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | - | Google OAuth client secret |
| `GOOGLE_REDIRECT_URL` | - | Google OAuth redirect URL |
| `LAWEXA_GUEST_TOKEN_EXPIRY` | 24 | Guest token expiry in hours |
| `LAWEXA_GEOIP_CACHE_TTL` | 86400 | GeoIP cache duration in seconds |

---

## Testing with cURL

### Register
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123","password_confirmation":"password123"}'
```

### Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Get Current User
```bash
curl http://localhost:8000/api/auth/me \
  -H "Accept: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Guest Token
```bash
curl -X POST http://localhost:8000/api/auth/guest \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"fingerprint":"unique-device-fingerprint"}'
```

### Logout
```bash
curl -X POST http://localhost:8000/api/auth/logout \
  -H "Accept: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```
