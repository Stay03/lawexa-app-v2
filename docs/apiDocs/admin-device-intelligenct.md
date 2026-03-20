# Admin Device Intelligence & Abuse Analysis - API Documentation

## Overview

These endpoints provide device intelligence and abuse analysis for administrators. They surface shared devices, IP clusters, and per-user device histories to help detect multi-accounting and suspicious activity.

**Key Features:**
- List all device records with search, filtering, sorting, and pagination
- Shared device report: find fingerprints or device IDs used by 2+ registered users (main abuse signal)
- IP cluster analysis: find IPs shared by 2+ registered users with geolocation and user profile data
- Per-user device history with active session counts
- Guest and bot users excluded from abuse analysis endpoints
- Cross-reference identifiers between fingerprint and device ID groups
- User profile data (university, law school, profession) included for contextual investigation

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [List Devices](#list-devices)
   - [Query Parameters](#query-parameters)
   - [Sorting](#sorting)
3. [Shared Device Report](#shared-device-report)
4. [IP Clusters](#ip-clusters)
5. [User Device History](#user-device-history)
6. [Response Fields](#response-fields)
7. [Example Requests & Responses](#example-requests--responses)
8. [Validation & Error Responses](#validation--error-responses)
9. [Implementation Files](#implementation-files)

---

## Authentication & Authorization

All endpoints require authentication via Sanctum and admin role.

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/admin/devices` | GET | Yes | Admin |
| `/api/admin/devices/shared` | GET | Yes | Admin |
| `/api/admin/devices/ip-clusters` | GET | Yes | Admin |
| `/api/admin/users/{uuid}/devices` | GET | Yes | Admin |

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

## List Devices

### GET /api/admin/devices

List all device records with filtering, sorting, and pagination. Each record represents a device snapshot captured at login time, including browser, platform, IP, geolocation, fingerprint, and the associated user.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | - | Search across device name, IP address, fingerprint, device ID, and user name/email (max 100 chars, LIKE match) |
| `country` | string | - | Filter by IP geolocation country (exact match on `ip_country`) |
| `device_type` | string | - | Filter by device type: `desktop`, `mobile`, `tablet`, `bot` |
| `browser` | string | - | Filter by browser name (exact match, e.g. `Chrome`, `Safari`) |
| `platform` | string | - | Filter by platform (exact match, e.g. `iOS`, `AndroidOS`, `Windows`) |
| `role[]` | array | - | Filter by user role(s): `superadmin`, `admin`, `researcher`, `user`, `guest`, `bot` |
| `date_from` | date | - | Filter devices active on or after this date |
| `date_to` | date | - | Filter devices active on or before this date (must be >= `date_from`) |
| `sort_by` | string | `last_active_at` | Sort field: `last_active_at`, `created_at` |
| `sort_order` | string | `desc` | Sort direction: `asc`, `desc` |
| `per_page` | integer | `15` | Items per page (1-100) |

### Sorting

| Sort Field | Description |
|------------|-------------|
| `last_active_at` | By most recent device activity (default, descending) |
| `created_at` | By device record creation date |

---

## Shared Device Report

### GET /api/admin/devices/shared

The primary abuse detection endpoint. Groups devices by fingerprint or device ID and returns only groups where 2+ **registered** users share the same identifier. Guest and bot users are excluded.

Each group includes:
- The shared identifier value
- Count of distinct users
- User details with profile data (university, law school, profession)
- All IP addresses associated with the group
- Cross-reference identifiers (e.g., when grouping by fingerprint, shows all associated device IDs)

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `group_by` | string | **required** | Group by: `fingerprint` or `device_id` |
| `per_page` | integer | `15` | Items per page (1-100) |

**Sorted by** `user_count` descending (most suspicious groups first).

**Exclusions:**
- Guest users (`role = guest`) are excluded from grouping
- Bot users (`role = bot`) are excluded from grouping
- Records with `NULL` or empty fingerprint/device_id are excluded

---

## IP Clusters

### GET /api/admin/devices/ip-clusters

Groups device records by IP address and returns only IPs shared by 2+ **registered** users. Useful for identifying users on the same network (e.g., university WiFi, office, or one person with multiple accounts).

Each cluster includes:
- The IP address
- Geolocation data (city, region, country) from the most recent device record for that IP
- Count of distinct users
- User details with profile data

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `per_page` | integer | `15` | Items per page (1-100) |

**Sorted by** `user_count` descending.

**Exclusions:** Same as shared device report (guest and bot users excluded).

**Geolocation note:** Geo data is sourced from the most recent device record per IP. The same IP can resolve to different cities over time (common with Nigerian mobile ISPs), so the displayed city reflects the latest observation.

---

## User Device History

### GET /api/admin/users/{uuid}/devices

List all devices a specific user has logged in from, with active session counts per device. This is the drill-down endpoint — after seeing a suspicious user in a shared device or IP cluster report, use this to see their full device footprint.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `uuid` | string | User UUID |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `per_page` | integer | `15` | Items per page (1-100) |

**Sorted by** `last_active_at` descending.

**Active sessions:** Counts Sanctum tokens linked to each device that have not expired (`expires_at IS NULL` or `expires_at > now()`).

---

## Response Fields

### Device Object (List Devices)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Device record ID |
| `device_name` | string | Raw device name (e.g. `Chrome on AndroidOS`) |
| `display_name` | string | Friendly display name |
| `device_type` | string | One of: `desktop`, `mobile`, `tablet`, `bot` |
| `browser` | string\|null | Browser name |
| `browser_version` | string\|null | Browser version |
| `platform` | string\|null | OS/platform name |
| `platform_version` | string\|null | OS/platform version |
| `ip_address` | string\|null | IP address at time of login |
| `location` | string\|null | Formatted location string (e.g. `Lagos, Lagos, Nigeria`) |
| `ip_country` | string\|null | Country from IP geolocation |
| `ip_country_code` | string\|null | ISO country code |
| `ip_region` | string\|null | Region/state |
| `ip_city` | string\|null | City |
| `ip_timezone` | string\|null | Timezone |
| `fingerprint` | string\|null | Browser fingerprint hash |
| `device_id` | string\|null | Client-generated device UUID |
| `user` | object\|null | Associated user: `uuid`, `name`, `email`, `role` |
| `last_active_at` | string\|null | ISO 8601 timestamp of last activity |
| `created_at` | string\|null | ISO 8601 timestamp of record creation |

### Shared Device Group Object

| Field | Type | Description |
|-------|------|-------------|
| `identifier` | string | The shared fingerprint or device_id value |
| `group_by` | string | Which field was grouped: `fingerprint` or `device_id` |
| `user_count` | integer | Number of distinct registered users sharing this identifier |
| `users` | array | List of users (see User in Group below) |
| `ip_addresses` | array | All distinct IP addresses associated with this group |
| `cross_identifiers` | array | The other identifier values (e.g., device_ids when grouping by fingerprint) |

### IP Cluster Object

| Field | Type | Description |
|-------|------|-------------|
| `ip_address` | string | The shared IP address |
| `ip_city` | string\|null | City from most recent record |
| `ip_region` | string\|null | Region from most recent record |
| `ip_country` | string\|null | Country from most recent record |
| `ip_country_code` | string\|null | ISO country code from most recent record |
| `user_count` | integer | Number of distinct registered users on this IP |
| `users` | array | List of users (see User in Group below) |

### User in Group (Shared Devices & IP Clusters)

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | string | User UUID |
| `name` | string | Full name |
| `email` | string\|null | Email address |
| `role` | string | User role |
| `university` | string\|null | From user profile |
| `law_school` | string\|null | From user profile |
| `profession` | string\|null | From user profile |

### User Device History Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Device record ID |
| `device_name` | string | Raw device name |
| `display_name` | string | Friendly display name |
| `device_type` | string | Device type |
| `browser` | string\|null | Browser name |
| `browser_version` | string\|null | Browser version |
| `platform` | string\|null | Platform name |
| `platform_version` | string\|null | Platform version |
| `ip_address` | string\|null | IP address |
| `location` | string\|null | Formatted location string |
| `ip_country` | string\|null | Country |
| `ip_country_code` | string\|null | ISO country code |
| `fingerprint` | string\|null | Browser fingerprint |
| `device_id` | string\|null | Device UUID |
| `active_sessions` | integer | Count of active (non-expired) Sanctum tokens on this device |
| `last_active_at` | string\|null | ISO 8601 timestamp |
| `created_at` | string\|null | ISO 8601 timestamp |

---

## Example Requests & Responses

### List Devices (basic)

```
GET /api/admin/devices?per_page=2
```

```json
{
  "success": true,
  "message": "Devices retrieved successfully.",
  "data": [
    {
      "id": 4531,
      "device_name": "Chrome on AndroidOS",
      "display_name": "Chrome on AndroidOS",
      "device_type": "mobile",
      "browser": "Chrome",
      "browser_version": "145.0.0.0",
      "platform": "AndroidOS",
      "platform_version": "10",
      "ip_address": "102.88.114.53",
      "location": "Lagos, Lagos, Nigeria",
      "ip_country": "Nigeria",
      "ip_country_code": "NG",
      "ip_region": "Lagos",
      "ip_city": "Lagos",
      "ip_timezone": "Africa/Lagos",
      "fingerprint": null,
      "device_id": "4d5ecce7-d0b5-44dc-9b4f-57fb2bb4e1c5",
      "user": {
        "uuid": "f411cb22-1b0d-4f79-b740-33ae5426df00",
        "name": "Winnifred Usoh",
        "email": "winnifredusoh0@gmail.com",
        "role": "user"
      },
      "last_active_at": "2026-03-17T23:01:26+00:00",
      "created_at": "2026-03-17T23:01:26+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 2,
    "total": 4458,
    "last_page": 2229,
    "from": 1,
    "to": 2
  },
  "links": {
    "first": "http://localhost:8000/api/admin/devices?page=1",
    "last": "http://localhost:8000/api/admin/devices?page=2229",
    "prev": null,
    "next": "http://localhost:8000/api/admin/devices?page=2"
  }
}
```

### List Devices with Filters

```
GET /api/admin/devices?country=Nigeria&device_type=desktop&sort_by=created_at&sort_order=asc&per_page=5
```

Returns only desktop devices geolocated to Nigeria, sorted by oldest first.

```
GET /api/admin/devices?role[]=user&search=ashleyinpurple
```

Searches for devices associated with a user matching "ashleyinpurple" (matches email).

```
GET /api/admin/devices?date_from=2026-03-01&date_to=2026-03-10&platform=iOS
```

Returns iOS devices active between March 1-10, 2026.

### Shared Devices (fingerprint)

```
GET /api/admin/devices/shared?group_by=fingerprint&per_page=2
```

```json
{
  "success": true,
  "message": "Shared devices retrieved successfully.",
  "data": [
    {
      "identifier": "3e5442a902b1def480c63fe0d7424b90",
      "group_by": "fingerprint",
      "user_count": 14,
      "users": [
        {
          "uuid": "c2ee0e68-1ea8-40c6-a01b-92a53b1c86a1",
          "name": "Favour Emevu",
          "email": "ashleyinpurple@gmail.com",
          "role": "user",
          "university": "Delta State University",
          "law_school": null,
          "profession": "student"
        },
        {
          "uuid": "55ce9dd2-8013-4cc6-a351-71f36cc7ba8c",
          "name": "Tessa Blair",
          "email": "tessablair252008@gmail.com",
          "role": "user",
          "university": "University of Nigeria Enugu Campus",
          "law_school": null,
          "profession": "student"
        }
      ],
      "ip_addresses": [
        "105.113.117.4",
        "102.90.96.20",
        "105.120.131.110",
        "213.255.128.107"
      ],
      "cross_identifiers": [
        "f03a5627-3995-4532-bb6e-6c6e8da90a09",
        "4ce207ac-fd0d-4739-bcda-ca793dc6745e",
        "02ab3699-124a-4f2b-8c63-55c55aba0524"
      ]
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 2,
    "total": 77,
    "last_page": 39,
    "from": 1,
    "to": 2
  },
  "links": {
    "first": "http://localhost:8000/api/admin/devices/shared?page=1",
    "last": "http://localhost:8000/api/admin/devices/shared?page=39",
    "prev": null,
    "next": "http://localhost:8000/api/admin/devices/shared?page=2"
  }
}
```

### Shared Devices (device_id)

```
GET /api/admin/devices/shared?group_by=device_id&per_page=2
```

```json
{
  "success": true,
  "message": "Shared devices retrieved successfully.",
  "data": [
    {
      "identifier": "06d785f1-3fe6-4592-bada-87e6a120cf40",
      "group_by": "device_id",
      "user_count": 3,
      "users": [
        {
          "uuid": "316062a4-66b7-4ac7-a2b6-2f59630bf8a8",
          "name": "Muna Ojiego",
          "email": "munaojiego@gmail.com",
          "role": "user",
          "university": "Godfrey Okoye University",
          "law_school": null,
          "profession": "student"
        },
        {
          "uuid": "aa793794-8f75-4a10-9358-f82a1aeaee3f",
          "name": "Muna Ojiego",
          "email": "munaojiego9@gmail.com",
          "role": "user",
          "university": "Godfrey Okoye University",
          "law_school": null,
          "profession": "student"
        },
        {
          "uuid": "f8b0f7a9-4c8b-42f0-99f3-c21efcbbccad",
          "name": "Kelechi",
          "email": "kelefrank456@gmail.com",
          "role": "user",
          "university": "Godfrey Okoye University",
          "law_school": null,
          "profession": "student"
        }
      ],
      "ip_addresses": [
        "197.211.52.77",
        "197.211.52.76"
      ],
      "cross_identifiers": [
        "3196e67d0256f0c6336671d098aef017"
      ]
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 2,
    "total": 43,
    "last_page": 22,
    "from": 1,
    "to": 2
  },
  "links": {
    "first": "http://localhost:8000/api/admin/devices/shared?page=1",
    "last": "http://localhost:8000/api/admin/devices/shared?page=22",
    "prev": null,
    "next": "http://localhost:8000/api/admin/devices/shared?page=2"
  }
}
```

### IP Clusters

```
GET /api/admin/devices/ip-clusters?per_page=1
```

```json
{
  "success": true,
  "message": "IP clusters retrieved successfully.",
  "data": [
    {
      "ip_address": "213.255.128.107",
      "ip_city": "Ebute Ikorodu",
      "ip_region": "Lagos",
      "ip_country": "Nigeria",
      "ip_country_code": "NG",
      "user_count": 18,
      "users": [
        {
          "uuid": "9bd31648-026b-4014-8b7d-5a5cdeb05da5",
          "name": "Ayomiposi Adekanmbi",
          "email": "adekanmbiayomiposi2003@gmail.com",
          "role": "user",
          "university": "University of Lagos",
          "law_school": null,
          "profession": "student"
        },
        {
          "uuid": "b9699a17-facd-4fbf-a49b-6bc676ad4118",
          "name": "Samson Mogbadunade",
          "email": "mogbadunadesamson01@gmail.com",
          "role": "user",
          "university": "University of Lagos",
          "law_school": null,
          "profession": "student"
        }
      ]
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 1,
    "total": 276,
    "last_page": 276,
    "from": 1,
    "to": 1
  },
  "links": {
    "first": "http://localhost:8000/api/admin/devices/ip-clusters?page=1",
    "last": "http://localhost:8000/api/admin/devices/ip-clusters?page=276",
    "prev": null,
    "next": "http://localhost:8000/api/admin/devices/ip-clusters?page=2"
  }
}
```

### User Device History

```
GET /api/admin/users/{uuid}/devices?per_page=3
```

```json
{
  "success": true,
  "message": "User devices retrieved successfully.",
  "data": [
    {
      "id": 4019,
      "device_name": "Chrome on OS X",
      "display_name": "Chrome on OS X",
      "device_type": "desktop",
      "browser": "Chrome",
      "browser_version": "145.0.0.0",
      "platform": "OS X",
      "platform_version": "10_15_7",
      "ip_address": "105.112.24.0",
      "location": "Lagos, Lagos, Nigeria",
      "ip_country": "Nigeria",
      "ip_country_code": "NG",
      "fingerprint": "f7e858b55ac5ff8bb671af13fd48660c",
      "device_id": "f0857e88-9509-4a30-a17a-5ed1589f8b1f",
      "active_sessions": 1,
      "last_active_at": "2026-03-13T18:18:50+00:00",
      "created_at": "2026-03-13T18:18:50+00:00"
    },
    {
      "id": 29,
      "device_name": "Chrome on OS X",
      "display_name": "Chrome on OS X",
      "device_type": "desktop",
      "browser": "Chrome",
      "browser_version": "143.0.0.0",
      "platform": "OS X",
      "platform_version": "10_15_7",
      "ip_address": "102.36.228.187",
      "location": "Sagamu, Ogun State, Nigeria",
      "ip_country": "Nigeria",
      "ip_country_code": "NG",
      "fingerprint": null,
      "device_id": null,
      "active_sessions": 14,
      "last_active_at": "2026-02-19T08:08:59+00:00",
      "created_at": "2026-01-25T16:01:14+00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 3,
    "total": 19,
    "last_page": 7,
    "from": 1,
    "to": 3
  },
  "links": {
    "first": "http://localhost:8000/api/admin/users/{uuid}/devices?page=1",
    "last": "http://localhost:8000/api/admin/users/{uuid}/devices?page=7",
    "prev": null,
    "next": "http://localhost:8000/api/admin/users/{uuid}/devices?page=2"
  }
}
```

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

### Missing group_by (Shared Devices)

```
GET /api/admin/devices/shared
```

```json
{
  "success": false,
  "message": "The group_by parameter is required.",
  "errors": {
    "group_by": ["The group_by parameter is required."]
  }
}
```

### Invalid group_by Value

```
GET /api/admin/devices/shared?group_by=invalid
```

```json
{
  "success": false,
  "message": "group_by must be either fingerprint or device_id.",
  "errors": {
    "group_by": ["group_by must be either fingerprint or device_id."]
  }
}
```

### Invalid Device Type

```
GET /api/admin/devices?device_type=phone
```

```json
{
  "success": false,
  "message": "Device type must be one of: desktop, mobile, tablet, bot.",
  "errors": {
    "device_type": ["Device type must be one of: desktop, mobile, tablet, bot."]
  }
}
```

### Invalid Date Range

```
GET /api/admin/devices?date_from=2026-03-10&date_to=2026-03-01
```

```json
{
  "success": false,
  "message": "End date must be on or after start date.",
  "errors": {
    "date_to": ["End date must be on or after start date."]
  }
}
```

### Invalid User UUID (User Devices)

```
GET /api/admin/users/invalid-uuid/devices
```

```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

---

## Intended Workflow

1. **Start with Shared Devices** (`/api/admin/devices/shared?group_by=fingerprint`) to find the most suspicious groups — same browser fingerprint across multiple accounts is a strong multi-accounting signal
2. **Cross-check with Device ID** (`/api/admin/devices/shared?group_by=device_id`) for additional confirmation
3. **Check IP Clusters** (`/api/admin/devices/ip-clusters`) for network-level patterns — high user counts on a single IP may indicate a university campus (legitimate) or one person with many accounts
4. **Drill down into a user** (`/api/admin/users/{uuid}/devices`) to see their full device/IP history and active session count
5. **Use the device list** (`/api/admin/devices`) for general browsing and filtering (e.g., all guest devices from a specific country)

**Interpreting results:**
- Shared fingerprint = very likely same browser instance (strong abuse signal)
- Shared device_id = same physical device (strong abuse signal)
- Shared IP = same network (weaker signal — could be university, office, VPN)
- User profile data (university) helps distinguish legitimate shared IPs (e.g., 18 UNILAG students on campus WiFi) from suspicious activity

---

## Implementation Files

| File | Description |
|------|-------------|
| `app/Http/Controllers/Admin/DeviceController.php` | Controller with `index()`, `shared()`, `ipClusters()` methods |
| `app/Http/Controllers/Admin/UserController.php` | `devices()` method for user device history |
| `app/Http/Requests/Admin/ListDevicesRequest.php` | Validation for device list endpoint |
| `app/Http/Requests/Admin/SharedDevicesRequest.php` | Validation for shared devices endpoint |
| `app/Http/Requests/Admin/IpClustersRequest.php` | Validation for IP clusters endpoint |
| `app/Http/Resources/Admin/DeviceInfoResource.php` | API resource for device list |
| `app/Http/Resources/Admin/SharedDeviceGroupResource.php` | API resource for shared device groups |
| `app/Http/Resources/Admin/IpClusterResource.php` | API resource for IP clusters |
| `app/Http/Resources/Admin/UserDeviceHistoryResource.php` | API resource for user device history |
| `app/Models/UserDeviceInfo.php` | Model with `tokens()` relationship |
| `database/factories/UserDeviceInfoFactory.php` | Factory with `withFingerprint()`, `withDeviceId()` states |
| `routes/api.php` | Route registration |
| `tests/Feature/Admin/DeviceControllerTest.php` | 32 Pest feature tests |
