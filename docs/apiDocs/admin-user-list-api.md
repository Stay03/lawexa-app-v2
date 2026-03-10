# Admin User List - API Documentation

## Overview

This endpoint provides an administrative user listing with comprehensive user data including profile, subscription, PAYG, device, and activity information. Supports multi-select filtering, sorting, and pagination.

**Key Features:**
- List all users with 22 fields per user
- Multi-select filters (pass arrays for role, auth provider, profession, country, subscription plan)
- Boolean filters for online status, PAYG balance, creator status, email verification
- Date range filtering on join date
- Sortable by name, email, role, join date, and last seen
- Remaining AI messages computed per user (plan limit - used quota)
- Latest device info (IP, country, device type, platform)
- Soft-deleted users excluded automatically

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [List Users](#list-users)
   - [Query Parameters](#query-parameters)
   - [Multi-Select Filters](#multi-select-filters)
   - [Boolean Filters](#boolean-filters)
   - [Sorting](#sorting)
3. [Response Fields](#response-fields)
4. [Example Requests & Responses](#example-requests--responses)
5. [Validation & Error Responses](#validation--error-responses)
6. [Implementation Files](#implementation-files)

---

## Authentication & Authorization

All endpoints require authentication via Sanctum and admin role.

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/admin/users` | GET | Yes | Admin |

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

## List Users

### GET /api/admin/users

List all users with filtering, sorting, and pagination. Returns profile, subscription, PAYG, device, and activity data for each user.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | - | Search by user name or email (max 100 chars, LIKE match) |
| `role[]` | array | - | Filter by role(s): `superadmin`, `admin`, `researcher`, `user`, `guest`, `bot` |
| `auth_provider[]` | array | - | Filter by auth provider(s): `email`, `google` |
| `is_online` | boolean | - | Filter by online status (active within last 5 minutes) |
| `profession[]` | array | - | Filter by profession(s) from user profile (exact match) |
| `country[]` | array | - | Filter by country from most recent device info IP geolocation |
| `subscription_plan[]` | array | - | Filter by active subscription plan slug(s) |
| `has_payg_balance` | boolean | - | Filter by whether user has remaining PAYG messages |
| `is_creator` | boolean | - | Filter by creator status |
| `is_verified` | boolean | - | Filter by email verification status |
| `created_from` | date | - | Filter users created on or after this date |
| `created_to` | date | - | Filter users created on or before this date (must be >= `created_from`) |
| `sort_by` | string | `created_at` | Sort field: `name`, `email`, `role`, `created_at`, `last_seen_at` |
| `sort_order` | string | `desc` | Sort direction: `asc`, `desc` |
| `per_page` | integer | `15` | Items per page (1-100) |

### Multi-Select Filters

Array filters accept multiple values to match **any** of the provided values (OR logic within the filter). Pass values using bracket notation:

```
GET /api/admin/users?role[]=admin&role[]=researcher
GET /api/admin/users?country[]=Nigeria&country[]=Ghana&country[]=Kenya
GET /api/admin/users?profession[]=Lawyer&profession[]=Law+Student
GET /api/admin/users?subscription_plan[]=pro-monthly&subscription_plan[]=pro-annually
```

When multiple different filters are used together, they combine with AND logic:

```
# Users who are (admin OR researcher) AND (from Nigeria OR Ghana)
GET /api/admin/users?role[]=admin&role[]=researcher&country[]=Nigeria&country[]=Ghana
```

### Boolean Filters

Boolean filters accept `1`/`0` or `true`/`false`:

```
GET /api/admin/users?is_online=1
GET /api/admin/users?is_creator=0
GET /api/admin/users?is_verified=true
GET /api/admin/users?has_payg_balance=1
```

**Online status:** A user is considered "online" if their most recent device has `last_active_at` within the last 5 minutes. Users with no device info are always "offline".

### Sorting

| Sort Field | Description |
|------------|-------------|
| `name` | Alphabetical by user name |
| `email` | Alphabetical by email |
| `role` | Alphabetical by role value |
| `created_at` | By registration date (default, descending) |
| `last_seen_at` | By most recent device activity timestamp |

Users with no device activity have `null` for `last_seen_at` and sort last when sorting descending.

---

## Response Fields

### User Object

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `uuid` | string | `users.uuid` | User UUID (unique identifier) |
| `name` | string | `users.name` | Full name |
| `email` | string\|null | `users.email` | Email address (null for guest users) |
| `avatar_url` | string\|null | Computed | Uploaded avatar takes priority over OAuth provider avatar |
| `role` | string | `users.role` | One of: `superadmin`, `admin`, `researcher`, `user`, `guest`, `bot` |
| `auth_provider` | string | `users.auth_provider` | One of: `email`, `google` |
| `is_online` | boolean | Computed | Whether `last_active_at` is within last 5 minutes |
| `last_seen_at` | string\|null | `user_device_info.last_active_at` | ISO 8601 timestamp of last activity from most recent device |
| `profession` | string\|null | `user_profiles.profession` | User's profession |
| `university` | string\|null | `user_profiles.university` | University name (for students) |
| `area_of_study` | string\|null | `user_profiles.area_of_study` | Field of study |
| `subscription_plan` | string\|null | `plans.name` | Active subscription plan name, or `null` if none |
| `remaining_messages` | integer\|null | Computed | Remaining AI messages on plan. `null` = unlimited (admins). `0` = exhausted |
| `has_payg_balance` | boolean | Computed | Whether user has remaining PAYG messages |
| `payg_balance` | integer | Computed | Total remaining messages across all completed PAYG packs |
| `country` | string\|null | `user_device_info.ip_country` | Country from most recent device IP geolocation |
| `ip_address` | string\|null | `user_device_info.ip_address` | Most recent IP address |
| `ip_country` | string\|null | `user_device_info.ip_country` | Country from most recent device IP geolocation |
| `device_type` | string\|null | `user_device_info.device_type` | Most recent device type (e.g., `mobile`, `desktop`) |
| `platform` | string\|null | `user_device_info.platform` | Most recent platform (e.g., `iOS`, `Android`, `Windows`) |
| `is_creator` | boolean | `users.is_creator` | Whether user is a content creator |
| `is_verified` | boolean | Computed | Whether user's email is verified |
| `created_at` | string | `users.created_at` | Registration timestamp (ISO 8601) |

**Notes on computed fields:**

- **`remaining_messages`**: Calculated via `LimitService::getRemainingQuota()`. Accounts for plan limits, billing period, and message usage. Admin/superadmin/researcher users always return `null` (unlimited).
- **`payg_balance`**: Sum of `messages_remaining` across all completed message packs. Pending/failed packs are excluded.
- **`is_online` / `last_seen_at`**: Based on the user's most recently active device (highest `last_active_at`). If user has multiple devices, only the latest is used.
- **`country`**: Sourced from device info IP geolocation, **not** from the user profile country field.

---

## Example Requests & Responses

### Basic List (no filters)

```
GET /api/admin/users?per_page=3
```

```json
{
  "success": true,
  "message": "Users retrieved successfully.",
  "data": [
    {
      "uuid": "fa034958-2569-4918-bc7e-571447432aec",
      "name": "Google Auth User",
      "email": "kenneth97@example.net",
      "avatar_url": "https://via.placeholder.com/200x200.png/0077ff?text=people+amet",
      "role": "user",
      "auth_provider": "google",
      "is_online": false,
      "last_seen_at": null,
      "profession": null,
      "university": null,
      "area_of_study": null,
      "subscription_plan": null,
      "remaining_messages": 0,
      "has_payg_balance": false,
      "payg_balance": 0,
      "country": null,
      "ip_address": null,
      "ip_country": null,
      "device_type": null,
      "platform": null,
      "is_creator": false,
      "is_verified": true,
      "created_at": "2026-03-10T03:20:21+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 3,
    "total": 125,
    "last_page": 42,
    "from": 1,
    "to": 3
  },
  "links": {
    "first": "http://localhost:8000/api/admin/users?page=1",
    "last": "http://localhost:8000/api/admin/users?page=42",
    "prev": null,
    "next": "http://localhost:8000/api/admin/users?page=2"
  }
}
```

### Search by Name

```
GET /api/admin/users?search=Online+User
```

```json
{
  "success": true,
  "message": "Users retrieved successfully.",
  "data": [
    {
      "uuid": "ef4273f1-8bb8-4439-a0e0-b37c97f7bab0",
      "name": "Online User",
      "email": "orau@example.org",
      "avatar_url": null,
      "role": "user",
      "auth_provider": "email",
      "is_online": true,
      "last_seen_at": "2026-03-10T03:18:19+00:00",
      "profession": "Lawyer",
      "university": "Unilag",
      "area_of_study": "Corporate Law",
      "subscription_plan": "Pro Daily",
      "remaining_messages": 50,
      "has_payg_balance": false,
      "payg_balance": 0,
      "country": "Nigeria",
      "ip_address": "102.89.23.1",
      "ip_country": "Nigeria",
      "device_type": "mobile",
      "platform": "iOS",
      "is_creator": false,
      "is_verified": true,
      "created_at": "2026-03-10T03:20:15+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 1,
    "last_page": 1,
    "from": 1,
    "to": 1
  },
  "links": {
    "first": "http://localhost:8000/api/admin/users?page=1",
    "last": "http://localhost:8000/api/admin/users?page=1",
    "prev": null,
    "next": null
  }
}
```

### Multi-Role Filter

```
GET /api/admin/users?role[]=admin&role[]=superadmin
```

Returns only users with `admin` or `superadmin` roles.

### Online Users Only

```
GET /api/admin/users?is_online=1
```

Returns only users whose most recent device has been active within the last 5 minutes.

### Combined Filters

```
GET /api/admin/users?role[]=user&auth_provider[]=google&profession[]=Lawyer&country[]=Nigeria&is_creator=1
```

Returns users who match ALL of the following:
- Role is `user`
- Auth provider is `google`
- Profession is `Lawyer`
- Country (from device IP) is `Nigeria`
- Is a content creator

### Sort by Last Seen

```
GET /api/admin/users?sort_by=last_seen_at&sort_order=desc&per_page=5
```

Returns users sorted by most recent activity, with the most recently active users first.

### Users with PAYG Balance

```
GET /api/admin/users?has_payg_balance=1
```

Returns users who have at least one completed message pack with remaining messages.

### Date Range

```
GET /api/admin/users?created_from=2026-03-01&created_to=2026-03-10
```

Returns users who registered between March 1 and March 10, 2026.

### Admin/Superadmin Users (unlimited messages)

```
GET /api/admin/users?role[]=admin&role[]=superadmin
```

```json
{
  "data": [
    {
      "name": "Admin User",
      "role": "admin",
      "remaining_messages": null,
      "subscription_plan": null
    }
  ]
}
```

Admin and superadmin users bypass all message limits, so `remaining_messages` is always `null` (unlimited).

---

## Validation & Error Responses

All validation errors return HTTP 422 with the following structure:

```json
{
  "success": false,
  "message": "Human-readable summary of the first error.",
  "errors": {
    "field_name": ["Detailed error message."]
  }
}
```

### Invalid Role Value

```
GET /api/admin/users?role[]=invalid
```

```json
{
  "success": false,
  "message": "Each role must be one of: superadmin, admin, researcher, user, guest, bot.",
  "errors": {
    "role.0": ["Each role must be one of: superadmin, admin, researcher, user, guest, bot."]
  }
}
```

### Invalid Auth Provider

```
GET /api/admin/users?auth_provider[]=twitter
```

```json
{
  "success": false,
  "message": "Each auth provider must be one of: email, google.",
  "errors": {
    "auth_provider.0": ["Each auth provider must be one of: email, google."]
  }
}
```

### Invalid Date Range

```
GET /api/admin/users?created_from=2026-03-10&created_to=2026-03-01
```

```json
{
  "success": false,
  "message": "created_to must be on or after created_from.",
  "errors": {
    "created_to": ["created_to must be on or after created_from."]
  }
}
```

### Invalid Sort Field

```
GET /api/admin/users?sort_by=invalid
```

```json
{
  "success": false,
  "message": "sort_by must be one of: name, email, role, created_at, last_seen_at.",
  "errors": {
    "sort_by": ["sort_by must be one of: name, email, role, created_at, last_seen_at."]
  }
}
```

### Multiple Validation Errors

```
GET /api/admin/users?role[]=invalid_role&sort_by=bad_field
```

```json
{
  "success": false,
  "message": "sort_by must be one of: name, email, role, created_at, last_seen_at. (and 1 more error)",
  "errors": {
    "sort_by": ["sort_by must be one of: name, email, role, created_at, last_seen_at."],
    "role.0": ["Each role must be one of: superadmin, admin, researcher, user, guest, bot."]
  }
}
```

### Per Page Over Limit

```
GET /api/admin/users?per_page=200
```

```json
{
  "success": false,
  "message": "The per page field must not be greater than 100.",
  "errors": {
    "per_page": ["The per page field must not be greater than 100."]
  }
}
```

---

## Implementation Files

| File | Description |
|------|-------------|
| `app/Http/Controllers/Admin/UserController.php` | Controller with `index()` method |
| `app/Http/Requests/Admin/AdminUserListRequest.php` | Form request with validation rules and custom messages |
| `app/Http/Resources/Admin/AdminUserListResource.php` | API resource for response shaping |
| `app/Models/User.php` | `latestDevice()` and `activeSubscriptionWithPlan()` relationships |
| `app/Services/LimitService.php` | `getRemainingQuota()` for remaining AI messages |
| `routes/api.php` | Route registration |
| `tests/Feature/Admin/UserListTest.php` | 52 Pest feature tests |
