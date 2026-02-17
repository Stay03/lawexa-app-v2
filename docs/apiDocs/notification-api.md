# Notification System - API Documentation

## Overview

The notification system enables admins to send targeted messages to users and allows system events to trigger database notifications. Users can view, filter, and manage their in-app notifications with read/unread tracking.

**Key Features:**
- Admin broadcasts with flexible targeting (individual, multiple users, by role, or all users)
- Broadcast management: list, view details, and track recipient read status
- Notification analytics dashboard with stat cards, charts, and tables
- System-triggered notifications (e.g., content request fulfillment)
- Read/unread status tracking
- Pagination and filtering
- Bulk notification insertion for performance
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
   - [List Broadcasts](#get-apiadminnotifications)
   - [Show Broadcast](#get-apiadminnotificationsuuid)
   - [List Broadcast Recipients](#get-apiadminnotificationsuuidrecipients)
   - [Notification Analytics](#get-apiadminnotificationsanalytics)
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
| `/api/admin/notifications` | GET | Yes | Admin+ |
| `/api/admin/notifications/{uuid}` | GET | Yes | Admin+ |
| `/api/admin/notifications/{uuid}/recipients` | GET | Yes | Admin+ |
| `/api/admin/notifications/analytics` | GET | Yes | Admin+ |

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

### GET /api/admin/notifications

List all broadcasts with summary stats (read/unread counts). Requires admin role.

**Authorization:** `auth:sanctum`, `role:admin`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sort` | string | `created_at` | Sort field: `created_at`, `recipients_count`, `title` |
| `direction` | string | `desc` | Sort direction: `asc`, `desc` |
| `per_page` | integer | `15` | Items per page (clamped 1-100) |
| `page` | integer | `1` | Page number |

**Example Requests:**

```bash
GET /api/admin/notifications
GET /api/admin/notifications?per_page=10
GET /api/admin/notifications?sort=recipients_count&direction=desc
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Broadcasts retrieved successfully.",
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "title": "System Maintenance",
      "message": "Platform will be unavailable on Saturday 10AM-12PM",
      "action_url": null,
      "icon": "warning",
      "target_type": "all",
      "target_criteria": null,
      "recipients_count": 143,
      "read_count": 98,
      "unread_count": 45,
      "admin": {
        "uuid": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "name": "Admin User"
      },
      "created_at": "2026-02-17T10:30:00+00:00"
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
    "first": "http://localhost:8000/api/admin/notifications?page=1",
    "last": "http://localhost:8000/api/admin/notifications?page=1",
    "prev": null,
    "next": null
  }
}
```

**Notes:**
- Default sort is newest first (`created_at desc`)
- `read_count` and `unread_count` are computed from actual notification read status
- Only broadcasts created via the broadcast endpoint appear (not system notifications)

---

### GET /api/admin/notifications/{uuid}

Show details for a specific broadcast including read/unread counts. Requires admin role.

**Authorization:** `auth:sanctum`, `role:admin`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uuid` | uuid | Broadcast UUID (the `id` field from list response) |

**Example Request:**

```bash
GET /api/admin/notifications/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Broadcast retrieved successfully.",
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "System Maintenance",
    "message": "Platform will be unavailable on Saturday 10AM-12PM",
    "action_url": "https://status.example.com",
    "icon": "warning",
    "target_type": "all",
    "target_criteria": null,
    "recipients_count": 143,
    "read_count": 98,
    "unread_count": 45,
    "admin": {
      "uuid": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "name": "Admin User"
    },
    "created_at": "2026-02-17T10:30:00+00:00"
  }
}
```

**Error - Not Found (404):**

```json
{
  "success": false,
  "message": "Broadcast not found.",
  "errors": null
}
```

---

### GET /api/admin/notifications/{uuid}/recipients

List paginated recipients for a specific broadcast with their read status. Requires admin role.

**Authorization:** `auth:sanctum`, `role:admin`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uuid` | uuid | Broadcast UUID |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `per_page` | integer | `15` | Items per page (clamped 1-100) |
| `page` | integer | `1` | Page number |

**Example Request:**

```bash
GET /api/admin/notifications/a1b2c3d4-e5f6-7890-abcd-ef1234567890/recipients?per_page=10
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Recipients retrieved successfully.",
  "data": [
    {
      "notification_id": "36e69d4e-f888-4828-87f6-c620f0692b0d",
      "user": {
        "uuid": "c3d4e5f6-a7b8-9012-cdef-123456789012",
        "name": "John Doe",
        "email": "john@example.com",
        "role": "user"
      },
      "read_at": "2026-02-17T11:15:00+00:00",
      "created_at": "2026-02-17T10:30:00+00:00"
    },
    {
      "notification_id": "47f7ae5f-g999-5939-98g7-d731g1793c1e",
      "user": {
        "uuid": "d4e5f6a7-b8c9-0123-defg-234567890123",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "role": "researcher"
      },
      "read_at": null,
      "created_at": "2026-02-17T10:30:00+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 10,
    "total": 143,
    "last_page": 15,
    "from": 1,
    "to": 10
  },
  "links": {
    "first": "...",
    "last": "...",
    "prev": null,
    "next": "..."
  }
}
```

**Error - Not Found (404):**

```json
{
  "success": false,
  "message": "Broadcast not found.",
  "errors": null
}
```

**Notes:**
- `read_at: null` means the recipient has not read the notification yet
- Each recipient includes their user details (uuid, name, email, role)

---

### GET /api/admin/notifications/analytics

Notification analytics dashboard with stat cards, charts, and tables. Requires admin role.

**Authorization:** `auth:sanctum`, `role:admin`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `30d` | Period: `today`, `7d`, `30d`, `90d`, `custom` |
| `start_date` | date | - | Required when `period=custom` (format: `YYYY-MM-DD`) |
| `end_date` | date | - | Required when `period=custom` (format: `YYYY-MM-DD`) |

**Example Requests:**

```bash
GET /api/admin/notifications/analytics
GET /api/admin/notifications/analytics?period=7d
GET /api/admin/notifications/analytics?period=custom&start_date=2026-01-01&end_date=2026-02-01
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Notification analytics retrieved successfully.",
  "data": {
    "period": {
      "start": "2026-01-18T00:00:00+00:00",
      "end": "2026-02-17T12:00:00+00:00",
      "comparison_start": "2025-12-19T00:00:00+00:00",
      "comparison_end": "2026-01-17T23:59:59+00:00"
    },
    "stat_cards": {
      "total_broadcasts": {
        "value": 12,
        "change_percent": 50.0
      },
      "total_notifications_sent": {
        "value": 456,
        "change_percent": 25.3
      },
      "read_rate": {
        "value": 68.5,
        "change_percent": 5.2
      },
      "avg_recipients_per_broadcast": {
        "value": 38.0,
        "change_percent": -10.0
      }
    },
    "charts": {
      "broadcasts_over_time": [
        {
          "date": "2026-02-15",
          "broadcasts": 2,
          "notifications_sent": 86
        },
        {
          "date": "2026-02-17",
          "broadcasts": 3,
          "notifications_sent": 145
        }
      ],
      "read_vs_unread": [
        {
          "date": "2026-02-15",
          "read": 45,
          "unread": 41
        },
        {
          "date": "2026-02-17",
          "read": 80,
          "unread": 65
        }
      ],
      "target_type_distribution": [
        {
          "target_type": "all",
          "count": 5,
          "percentage": 41.7
        },
        {
          "target_type": "role",
          "count": 4,
          "percentage": 33.3
        },
        {
          "target_type": "users",
          "count": 2,
          "percentage": 16.7
        },
        {
          "target_type": "user",
          "count": 1,
          "percentage": 8.3
        }
      ]
    },
    "tables": {
      "recent_broadcasts": [
        {
          "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "title": "System Maintenance",
          "target_type": "all",
          "admin_name": "Admin User",
          "recipients_count": 143,
          "read_count": 98,
          "unread_count": 45,
          "created_at": "2026-02-17T10:30:00+00:00"
        }
      ],
      "top_admins_by_broadcasts": [
        {
          "uuid": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
          "name": "Admin User",
          "broadcasts_count": 8
        }
      ]
    }
  }
}
```

**Stat Cards:**

| Stat Card | Description |
|-----------|-------------|
| `total_broadcasts` | Number of broadcasts in the period |
| `total_notifications_sent` | Total individual notifications delivered |
| `read_rate` | Percentage of notifications that have been read (0-100) |
| `avg_recipients_per_broadcast` | Average recipients per broadcast |

Each stat card includes a `change_percent` comparing the current period to the previous period of equal length. `null` means no data in the previous period.

**Charts:**

| Chart | Description |
|-------|-------------|
| `broadcasts_over_time` | Daily broadcast count with total notifications sent |
| `read_vs_unread` | Daily read vs unread notification counts |
| `target_type_distribution` | Breakdown of broadcasts by target type with percentages |

**Tables:**

| Table | Description |
|-------|-------------|
| `recent_broadcasts` | Latest 10 broadcasts with stats |
| `top_admins_by_broadcasts` | Top 10 admins ranked by broadcast count |

**Validation Errors (422):**

```json
{
  "success": false,
  "message": "Period must be: today, 7d, 30d, 90d, or custom.",
  "errors": {
    "period": ["Period must be: today, 7d, 30d, 90d, or custom."]
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

### Notification Resource (User-facing)

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

### Broadcast Resource (Admin)

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Broadcast UUID |
| `title` | string | Broadcast title |
| `message` | string | Broadcast message body |
| `action_url` | string\|null | Optional URL for CTA button |
| `icon` | string\|null | Optional icon identifier |
| `target_type` | string | Target type: `user`, `users`, `role`, `all` |
| `target_criteria` | object\|null | Targeting details (e.g., `{"role": "researcher"}`, `{"user_ids": [1,2]}`) |
| `recipients_count` | integer | Total number of recipients |
| `read_count` | integer | Number of recipients who have read |
| `unread_count` | integer | Number of recipients who haven't read |
| `admin` | object | Sender info: `{uuid, name}` |
| `created_at` | datetime | ISO 8601 creation timestamp |

---

### Broadcast Recipient Resource (Admin)

| Field | Type | Description |
|-------|------|-------------|
| `notification_id` | uuid | Individual notification UUID |
| `user` | object | Recipient info: `{uuid, name, email, role}` |
| `read_at` | datetime\|null | ISO 8601 timestamp when read (null = unread) |
| `created_at` | datetime | ISO 8601 timestamp when notification was created |

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

### Broadcast Tracking

Each broadcast creates a `notification_broadcasts` record that links to individual notification rows via `broadcast_id`:
- Tracks which admin sent the broadcast, targeting type, and recipient count
- Enables read/unread stats per broadcast without scanning notification data JSON
- Backward compatible: existing notifications (before this feature) have `broadcast_id = NULL` and won't appear in broadcast history

### Performance

- **Bulk Insert:** Broadcasts use `DB::table('notifications')->insert()` in chunks of 500 for efficient delivery
- **Pagination:** Hard limit of 100 items per page for admin endpoints, 50 for user endpoints
- **Indexing:** Database indexes on `notifiable_id`, `read_at`, `broadcast_id` for fast queries
- **Eager Loading:** Service layer pre-loads relationships to avoid N+1 queries
- **Aggregation:** Read/unread counts use `withCount` with closures for efficient counting

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

### Example 5: Admin Reviews Broadcast Performance

```bash
# 1. List recent broadcasts
curl -X GET "http://localhost:8000/api/admin/notifications?per_page=5" \
  -H "Authorization: Bearer {admin_token}"

# 2. View details for a specific broadcast
curl -X GET "http://localhost:8000/api/admin/notifications/{uuid}" \
  -H "Authorization: Bearer {admin_token}"

# 3. Check which recipients have read it
curl -X GET "http://localhost:8000/api/admin/notifications/{uuid}/recipients" \
  -H "Authorization: Bearer {admin_token}"
```

### Example 6: Admin Views Notification Analytics

```bash
# Default 30-day analytics
curl -X GET "http://localhost:8000/api/admin/notifications/analytics" \
  -H "Authorization: Bearer {admin_token}"

# Last 7 days
curl -X GET "http://localhost:8000/api/admin/notifications/analytics?period=7d" \
  -H "Authorization: Bearer {admin_token}"

# Custom date range
curl -X GET "http://localhost:8000/api/admin/notifications/analytics?period=custom&start_date=2026-01-01&end_date=2026-01-31" \
  -H "Authorization: Bearer {admin_token}"
```

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-17 | 1.1 | Added admin broadcast management endpoints (list, show, recipients), notification analytics dashboard, broadcast tracking table |
| 2026-02-14 | 1.0 | Initial release |
