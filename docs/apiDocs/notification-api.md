# Notification System - API Documentation

## Overview

The notification system enables admins to send targeted messages to users and allows system events to trigger database notifications. Users can view, filter, and manage their in-app notifications with read/unread tracking.

**Key Features:**
- Admin broadcasts with flexible targeting (individual, multiple users, by role, or all users)
- System-triggered notifications (e.g., content request fulfillment)
- Read/unread status tracking
- Pagination and filtering
- Queued notification delivery for performance
- Role-based access control

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [User Notification Endpoints](#user-notification-endpoints)
   - [List Notifications](#get-apinotifications)
   - [Get Unread Count](#get-apinotificationsunread-count)
   - [Mark as Read](#post-apinotificationsidread)
   - [Mark All as Read](#post-apinotificationsread-all)
   - [Delete Notification](#delete-apinotificationsid)
3. [Admin Notification Endpoints](#admin-notification-endpoints)
   - [Broadcast Notification](#post-apiadminnotificationsbroadcast)
4. [Targeting Options](#targeting-options)
5. [Validation & Error Responses](#validation--error-responses)
6. [Data Models](#data-models)

---

## Authentication & Authorization

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/notifications` | GET | Yes | Any (returns own notifications only) |
| `/api/notifications/unread-count` | GET | Yes | Any |
| `/api/notifications/{id}/read` | POST | Yes | Any (own notifications only) |
| `/api/notifications/read-all` | POST | Yes | Any |
| `/api/notifications/{id}` | DELETE | Yes | Any (own notifications only) |
| `/api/admin/notifications/broadcast` | POST | Yes | Admin+ |

**Unauthenticated (401):**

```json
{
  "success": false,
  "message": "Unauthenticated.",
  "errors": null
}
```

**Non-Admin User Trying Admin Endpoint (403):**

```json
{
  "success": false,
  "message": "Insufficient permissions. This action requires at least admin role."
}
```

**Accessing Another User's Notification (404):**

```json
{
  "success": false,
  "message": "Notification not found.",
  "errors": null
}
```

---

## User Notification Endpoints

### GET /api/notifications

List the authenticated user's notifications with optional filtering and pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `read` | string | - | Filter by status: `read`, `unread` (omit for all) |
| `sort` | string | `created_at` | Sort field: `created_at`, `read_at` |
| `direction` | string | `desc` | Sort direction: `asc`, `desc` |
| `per_page` | integer | `15` | Items per page (clamped 1-50) |
| `page` | integer | `1` | Page number |

**Example Requests:**

```bash
GET /api/notifications
GET /api/notifications?read=unread
GET /api/notifications?read=read&per_page=20
GET /api/notifications?sort=read_at&direction=asc
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Notifications retrieved successfully.",
  "data": [
    {
      "id": "36e69d4e-f888-4828-87f6-c620f0692b0d",
      "type": "AdminMessageNotification",
      "title": "System Announcement",
      "message": "Platform will be down for maintenance on Saturday",
      "action_url": "https://example.com/maintenance",
      "icon": "warning",
      "read_at": null,
      "created_at": "2026-02-14T05:47:33+00:00"
    },
    {
      "id": "15bf537a-66dc-4b5d-b189-7735763ab4b4",
      "type": "AdminMessageNotification",
      "title": "Welcome!",
      "message": "Welcome to our platform",
      "action_url": null,
      "icon": null,
      "read_at": "2026-02-14T06:30:15+00:00",
      "created_at": "2026-02-14T05:45:20+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 6,
    "last_page": 1,
    "from": 1,
    "to": 6
  },
  "links": {
    "first": "http://localhost:8000/api/notifications?page=1",
    "last": "http://localhost:8000/api/notifications?page=1",
    "prev": null,
    "next": null
  }
}
```

**Notes:**
- Returns only the authenticated user's notifications
- `per_page` is automatically clamped between 1 and 50
- Default sort is newest first (`created_at desc`)
- Unread notifications have `read_at: null`

---

### GET /api/notifications/unread-count

Get the count of unread notifications for the authenticated user.

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Unread count retrieved successfully.",
  "data": {
    "unread_count": 4
  }
}
```

**Notes:**
- Lightweight endpoint for badge counts
- Only counts notifications where `read_at IS NULL`

---

### POST /api/notifications/{id}/read

Mark a specific notification as read.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Notification UUID |

**Example Request:**

```bash
POST /api/notifications/36e69d4e-f888-4828-87f6-c620f0692b0d/read
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Notification marked as read.",
  "data": null
}
```

**Error - Not Found (404):**

```json
{
  "success": false,
  "message": "Notification not found.",
  "errors": null
}
```

**Notes:**
- Idempotent: marking an already-read notification succeeds
- Returns 404 if notification doesn't exist or belongs to another user
- Sets `read_at` timestamp to current datetime

---

### POST /api/notifications/read-all

Mark all notifications as read for the authenticated user.

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "All notifications marked as read.",
  "data": {
    "marked_count": 5
  }
}
```

**Notes:**
- Updates all unread notifications in a single operation
- Returns count of notifications that were marked as read
- If all notifications are already read, returns `marked_count: 0`

---

### DELETE /api/notifications/{id}

Delete a specific notification.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Notification UUID |

**Example Request:**

```bash
DELETE /api/notifications/36e69d4e-f888-4828-87f6-c620f0692b0d
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Notification deleted successfully."
}
```

**Error - Not Found (404):**

```json
{
  "success": false,
  "message": "Notification not found.",
  "errors": null
}
```

**Notes:**
- Permanently deletes the notification
- Returns 404 if notification doesn't exist or belongs to another user
- No way to restore deleted notifications

---

## Admin Notification Endpoints

### POST /api/admin/notifications/broadcast

Broadcast a notification to targeted users. Requires admin role.

**Authorization:** `auth:sanctum`, `role:admin`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | Max 255 characters |
| `message` | string | Yes | Max 2000 characters |
| `action_url` | string | No | Valid URL, max 500 characters |
| `icon` | string | No | Max 50 characters |
| `user_id` | integer | No* | Must exist in users table |
| `user_ids` | array | No* | Array of valid user IDs |
| `role` | string | No* | One of: `user`, `researcher`, `admin`, `superadmin` |
| `broadcast_to_all` | boolean | No* | Send to all non-guest users |

***At least one targeting option required** (`user_id`, `user_ids`, `role`, or `broadcast_to_all`)

**Example Requests:**

**1. Broadcast to Single User:**

```bash
curl -X POST "http://localhost:8000/api/admin/notifications/broadcast" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 85,
    "title": "Account Upgraded",
    "message": "Your account has been upgraded to Premium",
    "action_url": "https://example.com/premium",
    "icon": "star"
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Notification sent to 1 user(s) successfully.",
  "data": {
    "recipients_count": 1
  }
}
```

**2. Broadcast to Multiple Users:**

```bash
curl -X POST "http://localhost:8000/api/admin/notifications/broadcast" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_ids": [85, 86, 87],
    "title": "Important Update",
    "message": "Please review the new terms of service"
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Notification sent to 3 user(s) successfully.",
  "data": {
    "recipients_count": 3
  }
}
```

**3. Broadcast to All Users with Role:**

```bash
curl -X POST "http://localhost:8000/api/admin/notifications/broadcast" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "researcher",
    "title": "New Research Guidelines",
    "message": "Please review the updated content request workflow",
    "action_url": "https://example.com/guidelines"
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Notification sent to 12 user(s) successfully.",
  "data": {
    "recipients_count": 12
  }
}
```

**4. Broadcast to All Users:**

```bash
curl -X POST "http://localhost:8000/api/admin/notifications/broadcast" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "broadcast_to_all": true,
    "title": "System Maintenance",
    "message": "Platform will be unavailable on Saturday 10AM-12PM",
    "icon": "warning"
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Notification sent to 143 user(s) successfully.",
  "data": {
    "recipients_count": 143
  }
}
```

**5. Combined Targeting (user_ids + role):**

```bash
curl -X POST "http://localhost:8000/api/admin/notifications/broadcast" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_ids": [85, 86],
    "role": "researcher",
    "title": "Urgent: Review Required",
    "message": "Please review pending content requests"
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Notification sent to 14 user(s) successfully.",
  "data": {
    "recipients_count": 14
  }
}
```

---

## Targeting Options

### Single User (`user_id`)

Sends notification to exactly one user by ID.

```json
{
  "user_id": 85,
  "title": "...",
  "message": "..."
}
```

**Use Cases:**
- Personal account updates
- Individual warnings or alerts
- User-specific promotions

---

### Multiple Users (`user_ids`)

Sends notification to specific users by their IDs.

```json
{
  "user_ids": [85, 86, 87, 88],
  "title": "...",
  "message": "..."
}
```

**Use Cases:**
- Team announcements
- Selected user campaigns
- Manual targeting

**Notes:**
- All user IDs must exist or validation fails
- Maximum recommended: ~100 users (for larger groups, use role or broadcast_to_all)

---

### By Role (`role`)

Sends notification to all users with a specific role.

```json
{
  "role": "researcher",
  "title": "...",
  "message": "..."
}
```

**Valid Roles:**
- `user` - Regular users
- `researcher` - Researchers
- `admin` - Administrators
- `superadmin` - Super administrators

**Notes:**
- Does NOT include guest users
- Efficient for large groups with shared role

---

### Broadcast to All (`broadcast_to_all`)

Sends notification to all non-guest users in the system.

```json
{
  "broadcast_to_all": true,
  "title": "...",
  "message": "..."
}
```

**Use Cases:**
- System-wide announcements
- Platform maintenance notices
- Critical security updates

**Notes:**
- Automatically excludes users with role `guest`
- Use sparingly to avoid notification fatigue
- Queued for async processing to prevent timeouts

---

### Combined Targeting

You can combine `user_ids` and `role` to send to both groups:

```json
{
  "user_ids": [85, 86],
  "role": "researcher",
  "title": "...",
  "message": "..."
}
```

**Recipients:** All users with ID 85, 86, OR role `researcher` (union, not intersection)

---

## Validation & Error Responses

### Missing Title (422)

```json
{
  "success": false,
  "message": "Please provide a notification title.",
  "errors": {
    "title": ["Please provide a notification title."]
  }
}
```

### Missing Message (422)

```json
{
  "success": false,
  "message": "Please provide a notification message.",
  "errors": {
    "message": ["Please provide a notification message."]
  }
}
```

### No Targeting Option (422)

```json
{
  "success": false,
  "message": "Please specify at least one targeting option (user_id, user_ids, role, or broadcast_to_all).",
  "errors": {
    "targeting": [
      "Please specify at least one targeting option (user_id, user_ids, role, or broadcast_to_all)."
    ]
  }
}
```

### Title Too Long (422)

```json
{
  "success": false,
  "message": "Notification title cannot exceed 255 characters.",
  "errors": {
    "title": ["Notification title cannot exceed 255 characters."]
  }
}
```

### Message Too Long (422)

```json
{
  "success": false,
  "message": "Notification message cannot exceed 2000 characters.",
  "errors": {
    "message": ["Notification message cannot exceed 2000 characters."]
  }
}
```

### Invalid URL (422)

```json
{
  "success": false,
  "message": "Action URL must be a valid URL.",
  "errors": {
    "action_url": ["Action URL must be a valid URL."]
  }
}
```

### Non-Existent User (422)

```json
{
  "success": false,
  "message": "The specified user does not exist.",
  "errors": {
    "user_id": ["The specified user does not exist."]
  }
}
```

### Invalid Role (422)

```json
{
  "success": false,
  "message": "Role must be user, researcher, admin, or superadmin.",
  "errors": {
    "role": ["Role must be user, researcher, admin, or superadmin."]
  }
}
```

### Mixed Valid/Invalid User IDs (422)

```json
{
  "success": false,
  "message": "One or more specified users do not exist.",
  "errors": {
    "user_ids.1": ["One or more specified users do not exist."]
  }
}
```

### Invalid Array Types (422)

```json
{
  "success": false,
  "message": "The user_ids.0 field must be an integer. (and 1 more error)",
  "errors": {
    "user_ids.0": ["The user_ids.0 field must be an integer."],
    "user_ids.1": ["The user_ids.1 field must be an integer."]
  }
}
```

---

## Data Models

### Notification Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique notification identifier |
| `type` | string | Notification class name (e.g., `AdminMessageNotification`) |
| `title` | string | Notification title |
| `message` | string | Notification message body |
| `action_url` | string\|null | Optional URL for CTA button |
| `icon` | string\|null | Optional icon identifier for UI |
| `read_at` | datetime\|null | ISO 8601 timestamp when read (null = unread) |
| `created_at` | datetime | ISO 8601 creation timestamp |

**Example:**

```json
{
  "id": "36e69d4e-f888-4828-87f6-c620f0692b0d",
  "type": "AdminMessageNotification",
  "title": "Welcome!",
  "message": "Welcome to our platform",
  "action_url": "https://example.com/onboarding",
  "icon": "hand-wave",
  "read_at": null,
  "created_at": "2026-02-14T05:47:33+00:00"
}
```

---

### Pagination Response

| Field | Type | Description |
|-------|------|-------------|
| `current_page` | integer | Current page number |
| `per_page` | integer | Items per page (1-50) |
| `total` | integer | Total notifications count |
| `last_page` | integer | Last page number |
| `from` | integer | Index of first item on page |
| `to` | integer | Index of last item on page |

**Example:**

```json
{
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 42,
    "last_page": 3,
    "from": 1,
    "to": 15
  },
  "links": {
    "first": "http://localhost:8000/api/notifications?page=1",
    "last": "http://localhost:8000/api/notifications?page=3",
    "prev": null,
    "next": "http://localhost:8000/api/notifications?page=2"
  }
}
```

---

## Implementation Notes

### Queuing

All notifications are queued for async delivery:
- Admin broadcasts implement `ShouldQueue` interface
- Large recipient lists don't block HTTP response
- Failed notifications automatically retry per queue configuration

### Performance

- **Pagination:** Hard limit of 50 items per page prevents performance issues
- **Indexing:** Database indexes on `notifiable_id`, `read_at` for fast queries
- **Eager Loading:** Service layer pre-loads relationships to avoid N+1 queries

### Security

- **Authorization:** Users can only access their own notifications
- **SQL Injection:** All inputs validated and parameterized
- **XSS Prevention:** Frontend must sanitize notification content before rendering HTML

### Best Practices

**For Frontend Developers:**
1. Poll `/api/notifications/unread-count` for badge updates (every 30-60s)
2. Sanitize `title` and `message` before rendering as HTML
3. Use `action_url` for notification click-through tracking
4. Display `icon` based on predefined icon set (don't trust arbitrary values)
5. Format `read_at` and `created_at` timestamps in user's timezone

**For Admins:**
1. Use `broadcast_to_all` sparingly to avoid notification fatigue
2. Keep titles under 50 characters for mobile display
3. Keep messages under 150 characters for push notifications
4. Always provide `action_url` when asking users to take action
5. Test broadcasts with `user_id` before sending to larger groups

---

## Examples

### Example 1: User Checks Notifications on Login

```bash
# 1. Get unread count for badge
curl -X GET "http://localhost:8000/api/notifications/unread-count" \
  -H "Authorization: Bearer {token}"

# Response: {"success": true, "data": {"unread_count": 3}}

# 2. Fetch unread notifications
curl -X GET "http://localhost:8000/api/notifications?read=unread" \
  -H "Authorization: Bearer {token}"

# 3. User reads first notification
curl -X POST "http://localhost:8000/api/notifications/{id}/read" \
  -H "Authorization: Bearer {token}"
```

### Example 2: Admin Announces System Maintenance

```bash
curl -X POST "http://localhost:8000/api/admin/notifications/broadcast" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "broadcast_to_all": true,
    "title": "Scheduled Maintenance",
    "message": "Platform will be unavailable Saturday 10AM-12PM UTC for upgrades",
    "action_url": "https://status.example.com",
    "icon": "wrench"
  }'
```

### Example 3: Admin Notifies Researchers About New Feature

```bash
curl -X POST "http://localhost:8000/api/admin/notifications/broadcast" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "researcher",
    "title": "New Bulk Upload Feature",
    "message": "You can now upload multiple cases at once via the new bulk upload tool",
    "action_url": "https://example.com/bulk-upload",
    "icon": "upload"
  }'
```

### Example 4: User Marks All Notifications as Read

```bash
# Mark all as read
curl -X POST "http://localhost:8000/api/notifications/read-all" \
  -H "Authorization: Bearer {token}"

# Response: {"success": true, "data": {"marked_count": 12}}

# Verify unread count is now 0
curl -X GET "http://localhost:8000/api/notifications/unread-count" \
  -H "Authorization: Bearer {token}"

# Response: {"success": true, "data": {"unread_count": 0}}
```

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-14 | 1.0 | Initial release |
