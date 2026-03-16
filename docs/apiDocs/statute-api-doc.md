# Phase 17: Statutes - API Documentation

## Overview

Phase 17 implements statute management for laws, acts, and constitutions. Statutes have hierarchical node trees (Chapter, Section, Subsection, etc.) with materialized slug paths for deep linking, DFS-based position indexes for virtualized scrolling, Meilisearch full-text search, and bookmark integration.

**Key Features:**
- Statute CRUD with soft-delete and restore
- Hierarchical node tree with flexible nesting (24 node types, AKN 3.0 standard)
- Materialized `slug_path` for deep-linkable URLs (e.g., `chapter-iv/section-33`)
- DFS `position` index for range-based virtual scrolling
- Deep link resolution: exact match, suffix match, ambiguous detection
- Meilisearch full-text search across titles, preambles, and node content
- Bookmark integration via existing polymorphic bookmark system
- Auto-generated slugs with collision handling
- AKN XML import (async with progress tracking) and export

---

## Table of Contents

1. [Statute Endpoints](#statute-endpoints)
2. [Statute Node Endpoints](#statute-node-endpoints)
3. [AKN Import/Export Endpoints](#akn-importexport-endpoints)
4. [Bookmark Integration](#bookmark-integration)
5. [Error Responses](#error-responses)
6. [Data Models](#data-models)
7. [Authorization Rules](#authorization-rules)

---

## Statute Endpoints

### Authentication

All endpoints require `auth:sanctum` middleware.

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/statutes` | GET | Yes | Any |
| `/api/statutes` | POST | Yes | Researcher+ |
| `/api/statutes/{slug}` | GET | Yes | Any |
| `/api/statutes/{id}` | PUT | Yes | Researcher+ |
| `/api/statutes/{id}` | DELETE | Yes | Researcher+ |
| `/api/statutes/{id}/restore` | POST | Yes | Admin |
| `/api/statutes/{slug}/nodes` | GET | Yes | Any |
| `/api/statutes/{slug}/navigate/{path}` | GET | Yes | Any |
| `/api/statutes/{id}/nodes` | POST | Yes | Researcher+ |
| `/api/statutes/{id}/nodes/{node}` | PUT | Yes | Researcher+ |
| `/api/statutes/{id}/nodes/{node}` | DELETE | Yes | Researcher+ |
| `/api/statutes/import-akn` | POST | Yes | Researcher+ |
| `/api/statutes/import-akn` | GET | Yes | Researcher+ |
| `/api/statutes/import-akn/{uuid}/status` | GET | Yes | Researcher+ |
| `/api/statutes/{slug}/export-akn` | GET | Yes | Any |

---

### POST /api/statutes

Create a new statute. Requires researcher role or higher.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | Max 500 characters |
| `short_title` | string | No | Max 255 characters |
| `preamble` | text | No | Preamble text |
| `description` | text | No | Description text |
| `country_id` | integer | No | Must exist in countries table |
| `year` | integer | Yes | 1000 to current year |
| `commencement_date` | date | No | Valid date |
| `status` | string | No | `active`, `repealed`, or `amended` (defaults to `active`) |

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/statutes" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "title": "Constitution of the Federal Republic of Nigeria 1999",
    "short_title": "1999 Constitution",
    "preamble": "WE, THE PEOPLE of the Federal Republic of Nigeria...",
    "description": "The supreme law of Nigeria.",
    "country_id": 1,
    "year": 1999,
    "commencement_date": "1999-05-29",
    "status": "active"
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Statute created successfully.",
  "data": {
    "id": 1,
    "uuid": "ac2ae2b9-cded-44cd-a9ba-b6ec8ac7f82e",
    "title": "Constitution of the Federal Republic of Nigeria 1999",
    "short_title": "1999 Constitution",
    "slug": "constitution-of-the-federal-republic-of-nigeria-1999",
    "preamble": "WE, THE PEOPLE of the Federal Republic of Nigeria...",
    "description": "The supreme law of Nigeria.",
    "country": {
      "id": 1,
      "name": "Nigeria",
      "code": "NG",
      "abbreviation": "NG",
      "slug": "nigeria",
      "created_at": "2026-01-16T00:28:32.000000Z",
      "updated_at": "2026-01-16T00:28:32.000000Z"
    },
    "year": 1999,
    "commencement_date": "1999-05-29",
    "status": "active",
    "status_label": "Active",
    "document_type": null,
    "frbr_uri": null,
    "creator": {
      "id": 76,
      "uuid": "05feb99f-2215-436c-b02e-1d8fbcb21514",
      "name": "Test Researcher",
      "email": "researcher@example.com",
      "role": "researcher",
      "is_creator": false,
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "created_at": "2026-02-09T05:52:25.000000Z"
    },
    "is_bookmarked": false,
    "bookmarks_count": 0,
    "created_at": "2026-02-28T23:45:00.000000Z",
    "updated_at": "2026-02-28T23:45:00.000000Z"
  }
}
```

**Validation Error (422) - Missing Required Fields:**
```json
{
  "success": false,
  "message": "Please provide a statute title. (and 1 more error)",
  "errors": {
    "title": ["Please provide a statute title."],
    "year": ["Please provide the year of enactment."]
  }
}
```

**Validation Error (422) - Future Year:**
```json
{
  "success": false,
  "message": "Year cannot be in the future.",
  "errors": {
    "year": ["Year cannot be in the future."]
  }
}
```

**Validation Error (422) - Invalid Country:**
```json
{
  "success": false,
  "message": "The selected country does not exist.",
  "errors": {
    "country_id": ["The selected country does not exist."]
  }
}
```

**Validation Error (422) - Invalid Status:**
```json
{
  "success": false,
  "message": "Status must be one of: active, repealed, amended.",
  "errors": {
    "status": ["Status must be one of: active, repealed, amended."]
  }
}
```

**Notes:**
- Slug is auto-generated from the title via `Str::slug()`
- If a slug collision occurs, a random 4-character suffix is appended (e.g., `test-act-wxct`)
- The authenticated user is automatically set as the creator
- Status defaults to `active` if not provided

---

### GET /api/statutes

List paginated statutes with optional filters.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | - | Full-text search via Meilisearch (titles, preamble, description, node content) |
| `country` | integer | - | Filter by country ID |
| `status` | string | - | Filter by status (`active`, `repealed`, `amended`) |
| `year` | integer | - | Filter by year of enactment |
| `sort` | string | `created_at` | Sort field (`title`, `year`, `created_at`, `updated_at`) |
| `order` | string | `desc` | Sort direction (`asc`, `desc`) |
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Example Request:**
```bash
curl "http://localhost:8000/api/statutes?status=active&sort=year&order=asc" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Statutes retrieved successfully.",
  "data": [
    {
      "id": 1,
      "uuid": "ac2ae2b9-cded-44cd-a9ba-b6ec8ac7f82e",
      "title": "Constitution of the Federal Republic of Nigeria 1999",
      "short_title": "1999 Constitution",
      "slug": "constitution-of-the-federal-republic-of-nigeria-1999",
      "preamble": "WE, THE PEOPLE of the Federal Republic of Nigeria...",
      "description": "The supreme law of Nigeria.",
      "country": {
        "id": 1,
        "name": "Nigeria",
        "code": "NG",
        "abbreviation": "NG",
        "slug": "nigeria",
        "created_at": "2026-01-16T00:28:32.000000Z",
        "updated_at": "2026-01-16T00:28:32.000000Z"
      },
      "year": 1999,
      "commencement_date": "1999-05-29",
      "status": "active",
      "status_label": "Active",
      "document_type": null,
      "frbr_uri": null,
      "creator": { "..." : "..." },
      "is_bookmarked": false,
      "bookmarks_count": 0,
      "created_at": "2026-02-28T23:45:00.000000Z",
      "updated_at": "2026-02-28T23:45:00.000000Z"
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
    "first": "http://localhost:8000/api/statutes?page=1",
    "last": "http://localhost:8000/api/statutes?page=1",
    "prev": null,
    "next": null
  }
}
```

**Notes:**
- When `search` is provided without an explicit `sort`, results are ordered by Meilisearch relevance
- `is_bookmarked` is efficiently loaded via `withExists()` for the authenticated user
- `bookmarks_count` is loaded via `withCount()`
- Country and creator are eager-loaded to prevent N+1 queries

---

### GET /api/statutes/{slug}

Show a single statute by its URL slug.

**Example Request:**
```bash
curl "http://localhost:8000/api/statutes/constitution-of-the-federal-republic-of-nigeria-1999" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Statute retrieved successfully.",
  "data": {
    "id": 1,
    "uuid": "ac2ae2b9-cded-44cd-a9ba-b6ec8ac7f82e",
    "title": "Constitution of the Federal Republic of Nigeria 1999",
    "short_title": "1999 Constitution",
    "slug": "constitution-of-the-federal-republic-of-nigeria-1999",
    "preamble": "WE, THE PEOPLE of the Federal Republic of Nigeria...",
    "description": "The supreme law of Nigeria.",
    "country": { "..." : "..." },
    "year": 1999,
    "commencement_date": "1999-05-29",
    "status": "active",
    "status_label": "Active",
    "document_type": null,
    "frbr_uri": null,
    "creator": { "..." : "..." },
    "root_nodes_count": 2,
    "nodes_count": 6,
    "is_bookmarked": true,
    "bookmarks_count": 1,
    "created_at": "2026-02-28T23:45:00.000000Z",
    "updated_at": "2026-02-28T23:45:00.000000Z"
  }
}
```

**Error Response (404) - Not Found:**
```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

**Notes:**
- Uses slug-based route model binding (`{statute:slug}`)
- Includes `root_nodes_count` (top-level chapters/parts) and `nodes_count` (all nodes)
- Includes `is_bookmarked` status for the authenticated user

---

### PUT /api/statutes/{id}

Update a statute. Requires researcher role or higher.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | No | Max 500 characters |
| `short_title` | string | No | Max 255 characters |
| `preamble` | text | No | Preamble text |
| `description` | text | No | Description text |
| `country_id` | integer | No | Must exist in countries table |
| `year` | integer | No | 1000 to current year |
| `commencement_date` | date | No | Valid date |
| `status` | string | No | `active`, `repealed`, or `amended` |

**Example Request:**
```bash
curl -X PUT "http://localhost:8000/api/statutes/1" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"status": "amended"}'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Statute updated successfully.",
  "data": {
    "id": 1,
    "uuid": "ac2ae2b9-cded-44cd-a9ba-b6ec8ac7f82e",
    "title": "Constitution of the Federal Republic of Nigeria 1999",
    "short_title": "1999 Constitution",
    "slug": "constitution-of-the-federal-republic-of-nigeria-1999",
    "preamble": "WE, THE PEOPLE of the Federal Republic of Nigeria...",
    "description": "The supreme law of Nigeria.",
    "country": { "..." : "..." },
    "year": 1999,
    "commencement_date": "1999-05-29",
    "status": "amended",
    "status_label": "Amended",
    "document_type": null,
    "frbr_uri": null,
    "creator": { "..." : "..." },
    "is_bookmarked": false,
    "bookmarks_count": 0,
    "created_at": "2026-02-28T23:45:00.000000Z",
    "updated_at": "2026-02-28T23:46:59.000000Z"
  }
}
```

**Notes:**
- Uses ID-based lookup (not slug)
- Only sends fields you want to change (all fields are `sometimes`)
- When `title` changes, slug is regenerated with collision handling
- Partial updates are supported — unchanged fields retain their values

---

### DELETE /api/statutes/{id}

Soft-delete a statute. Requires researcher role or higher.

**Example Request:**
```bash
curl -X DELETE "http://localhost:8000/api/statutes/1" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Statute deleted successfully.",
  "data": null
}
```

**Notes:**
- Soft-deletes the statute (nodes are preserved for restore)
- Associated bookmarks are automatically deleted
- Soft-deleted statutes are excluded from list and show endpoints

---

### POST /api/statutes/{id}/restore

Restore a soft-deleted statute. Requires admin role.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | The statute's primary ID |

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/statutes/1/restore" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Statute restored successfully.",
  "data": {
    "id": 1,
    "uuid": "ac2ae2b9-cded-44cd-a9ba-b6ec8ac7f82e",
    "title": "Constitution of the Federal Republic of Nigeria 1999",
    "slug": "constitution-of-the-federal-republic-of-nigeria-1999",
    "status": "active",
    "status_label": "Active",
    "document_type": null,
    "frbr_uri": null,
    "country": { "..." : "..." },
    "creator": { "..." : "..." },
    "is_bookmarked": false,
    "bookmarks_count": 0,
    "created_at": "2026-02-28T23:45:00.000000Z",
    "updated_at": "2026-02-28T23:47:31.000000Z"
  }
}
```

**Error Response (403) - Insufficient Role:**
```json
{
  "success": false,
  "message": "Insufficient permissions. This action requires at least admin role."
}
```

**Notes:**
- Uses the statute's primary `id` (not slug) since soft-deleted models aren't resolved via route model binding
- Only admins can restore — researchers get 403

---

## Statute Node Endpoints

Statute nodes represent the hierarchical structure of a statute (chapters, sections, subsections, etc.).

### POST /api/statutes/{id}/nodes

Add a node to a statute. Requires researcher role or higher.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `parent_id` | integer | No | Must belong to the same statute |
| `node_type` | string | Yes | One of: `act`, `chapter`, `part`, `section`, `subsection`, `article`, `rule`, `schedule`, `regulation`, `clause`, `paragraph`, `item`, `subparagraph`, `subpart`, `subclause`, `subrule`, `division`, `subdivision`, `title`, `book`, `point`, `crossheading`, `proviso`, `hcontainer` |
| `number` | string | No | Node number (e.g., `I`, `33`, `1`) |
| `title` | string | No | Node title |
| `content` | text | No | Node content/body |
| `order` | integer | No | Manual ordering (auto-calculated if omitted) |

**Example Request — Root Node:**
```bash
curl -X POST "http://localhost:8000/api/statutes/1/nodes" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"node_type": "chapter", "number": "I", "title": "General Provisions"}'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Node created successfully.",
  "data": {
    "id": 1,
    "statute_id": 1,
    "parent_id": null,
    "node_type": "chapter",
    "node_type_label": "Chapter",
    "number": "I",
    "title": "General Provisions",
    "content": null,
    "intro": null,
    "wrap_up": null,
    "slug": "chapter-i",
    "slug_path": "chapter-i",
    "order": 1,
    "position": 0,
    "depth": 0
  }
}
```

**Example Request — Child Node:**
```bash
curl -X POST "http://localhost:8000/api/statutes/1/nodes" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "parent_id": 1,
    "node_type": "section",
    "number": "1",
    "title": "Supremacy of Constitution",
    "content": "This Constitution is supreme and its provisions shall have binding force."
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Node created successfully.",
  "data": {
    "id": 3,
    "statute_id": 1,
    "parent_id": 1,
    "node_type": "section",
    "node_type_label": "Section",
    "number": "1",
    "title": "Supremacy of Constitution",
    "content": "This Constitution is supreme and its provisions shall have binding force.",
    "intro": null,
    "wrap_up": null,
    "slug": "section-1",
    "slug_path": "chapter-i/section-1",
    "order": 1,
    "position": 1,
    "depth": 1
  }
}
```

**Validation Error (422) - Missing Node Type:**
```json
{
  "success": false,
  "message": "Please provide a node type.",
  "errors": {
    "node_type": ["Please provide a node type."]
  }
}
```

**Validation Error (422) - Parent From Wrong Statute:**
```json
{
  "success": false,
  "message": "The parent node must belong to the same statute.",
  "errors": {
    "parent_id": ["The parent node must belong to the same statute."]
  }
}
```

**Notes:**
- `slug` is auto-generated from `node_type` and `number` (e.g., `section-33`)
- `slug_path` is built from the parent chain (e.g., `chapter-iv/section-33`)
- `depth` is auto-calculated (0 for root, parent.depth + 1 for children)
- `order` is auto-calculated as max sibling order + 1 if not provided
- `position` is recalculated via DFS traversal after every add/update/delete
- Adding a node triggers re-indexing of the parent statute in Meilisearch

---

### PUT /api/statutes/{id}/nodes/{node}

Update a node. Requires researcher role or higher.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `parent_id` | integer | No | Must belong to same statute, cannot be self |
| `node_type` | string | No | Valid node type |
| `number` | string | No | Node number |
| `title` | string | No | Node title |
| `content` | text | No | Node content/body |
| `order` | integer | No | Manual ordering |

**Example Request — Move Node to Different Parent:**
```bash
curl -X PUT "http://localhost:8000/api/statutes/1/nodes/5" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"parent_id": 1}'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Node updated successfully.",
  "data": {
    "id": 5,
    "statute_id": 1,
    "parent_id": 1,
    "node_type": "section",
    "node_type_label": "Section",
    "number": "33",
    "title": "Right to Life",
    "content": "Every person has a right to life.",
    "intro": null,
    "wrap_up": null,
    "slug": "section-33",
    "slug_path": "chapter-i/section-33",
    "order": 1,
    "position": 2,
    "depth": 1
  }
}
```

**Notes:**
- When `parent_id` changes, `slug_path` and `depth` are rebuilt for the node and all descendants
- When `node_type` or `number` changes, `slug` and `slug_path` are regenerated
- Position is recalculated after every update

---

### DELETE /api/statutes/{id}/nodes/{node}

Delete a node and all its descendants. Requires researcher role or higher.

**Example Request:**
```bash
curl -X DELETE "http://localhost:8000/api/statutes/1/nodes/1" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Node deleted successfully.",
  "data": null
}
```

**Notes:**
- Recursively deletes all child nodes (hard delete)
- Positions are recalculated for remaining nodes after deletion
- Triggers re-indexing of the parent statute in Meilisearch

---

### GET /api/statutes/{slug}/nodes

Load nodes within a position range for virtual scrolling.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `from` | integer | `0` | Start position (inclusive) |
| `to` | integer | `49` | End position (inclusive) |

**Example Request:**
```bash
curl "http://localhost:8000/api/statutes/constitution-of-the-federal-republic-of-nigeria-1999/nodes?from=0&to=2" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Nodes retrieved successfully.",
  "data": {
    "nodes": [
      {
        "id": 1,
        "statute_id": 1,
        "parent_id": null,
        "node_type": "chapter",
        "node_type_label": "Chapter",
        "number": "I",
        "title": "General Provisions",
        "content": null,
        "intro": null,
        "wrap_up": null,
        "slug": "chapter-i",
        "slug_path": "chapter-i",
        "order": 1,
        "position": 0,
        "depth": 0
      },
      {
        "id": 3,
        "statute_id": 1,
        "parent_id": 1,
        "node_type": "section",
        "node_type_label": "Section",
        "number": "1",
        "title": "Supremacy of Constitution",
        "content": "This Constitution is supreme...",
        "intro": null,
        "wrap_up": null,
        "slug": "section-1",
        "slug_path": "chapter-i/section-1",
        "order": 1,
        "position": 1,
        "depth": 1
      },
      {
        "id": 4,
        "statute_id": 1,
        "parent_id": 1,
        "node_type": "section",
        "node_type_label": "Section",
        "number": "2",
        "title": "The Federal Republic of Nigeria",
        "content": "Nigeria is one indivisible and indissoluble sovereign state.",
        "intro": null,
        "wrap_up": null,
        "slug": "section-2",
        "slug_path": "chapter-i/section-2",
        "order": 2,
        "position": 2,
        "depth": 1
      }
    ],
    "total_count": 6
  }
}
```

**Notes:**
- Uses slug-based statute lookup (`{statute:slug}`)
- Nodes are ordered by `position` (DFS traversal order)
- `total_count` returns the total number of nodes in the statute (for scrollbar sizing)
- The `depth` field indicates nesting level for frontend indentation
- Position ordering follows DFS: `Chapter I (0) → Section 1 (1) → Section 2 (2) → Chapter II (3) → Section 33 (4) → Subsection 1 (5)`

---

### GET /api/statutes/{slug}/navigate/{path}

Deep link to a specific node by its slug path. Supports exact and suffix matching.

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | Slash-separated slug path (e.g., `chapter-iv/section-33`) |

**Example Request — Exact Match:**
```bash
curl "http://localhost:8000/api/statutes/constitution-of-the-federal-republic-of-nigeria-1999/navigate/chapter-ii/section-33" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Node resolved successfully.",
  "data": {
    "node": {
      "id": 5,
      "statute_id": 1,
      "parent_id": 2,
      "node_type": "section",
      "node_type_label": "Section",
      "number": "33",
      "title": "Right to Life",
      "content": "Every person has a right to life, and no one shall be deprived intentionally of his life.",
      "intro": null,
      "wrap_up": null,
      "slug": "section-33",
      "slug_path": "chapter-ii/section-33",
      "order": 1,
      "position": 4,
      "depth": 1
    },
    "total_count": 6
  }
}
```

**Example Request — Suffix Match (shortened path):**
```bash
curl "http://localhost:8000/api/statutes/constitution-of-the-federal-republic-of-nigeria-1999/navigate/section-33" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

Returns the same node if `section-33` is unique within the statute.

**Error Response (422) — Ambiguous Path:**
```json
{
  "success": false,
  "message": "Ambiguous path. Multiple nodes match.",
  "errors": {
    "matches": [
      "chapter-i/section-1/subsection-2",
      "chapter-iv/section-33/subsection-2"
    ]
  }
}
```

**Error Response (404) — Not Found:**
```json
{
  "success": false,
  "message": "Node not found.",
  "errors": null
}
```

**Notes:**
- Resolution order: exact `slug_path` match → suffix match → 422 ambiguous / 404 not found
- Suffix matching allows shorter URLs when a node's slug is unique within the statute
- When multiple nodes match a suffix, a 422 is returned with all matching `slug_path` values
- The `{path}` route parameter uses `->where('path', '.*')` to allow slashes
- `total_count` is included for scrollbar sizing

---

## AKN Import/Export Endpoints

Akoma Ntoso (AKN) 3.0 XML is the international standard for legislative documents. These endpoints allow importing AKN XML files into the statute system and exporting statutes back to AKN XML.

### POST /api/statutes/import-akn

Upload an AKN XML file and start an asynchronous import. Requires researcher role or higher.

**Request:** `multipart/form-data`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `file` | file | Yes | XML file, max 50MB |
| `country_id` | integer | No | Must exist in countries table |
| `title` | string | No | Override extracted title, max 500 characters |
| `year` | integer | No | Override extracted year, 1800 to current year |

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/statutes/import-akn" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json" \
  -F "file=@constitution.xml" \
  -F "title=Constitution of Nigeria" \
  -F "country_id=1" \
  -F "year=1999"
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Import started. Poll the status endpoint for progress.",
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "pending",
    "status_label": "Pending",
    "original_filename": "constitution.xml",
    "total_nodes": 0,
    "processed_nodes": 0,
    "progress": 0,
    "statute_id": null,
    "statute_slug": null,
    "options": {"country_id": 1, "title": "Constitution of Nigeria", "year": 1999},
    "created_at": "2026-03-16T14:00:00.000000Z",
    "updated_at": "2026-03-16T14:00:00.000000Z"
  }
}
```

**Validation Error (422) - Too Many Active Imports:**
```json
{
  "success": false,
  "message": "You already have 3 active imports. Please wait for them to complete.",
  "errors": {
    "file": ["You already have 3 active imports. Please wait for them to complete."]
  }
}
```

**Notes:**
- The import runs asynchronously via a queued job
- Use the returned `id` (UUID) to poll for progress
- Maximum 3 concurrent imports per user (pending + processing)
- The parser extracts title, year, preamble, and document type from the XML `<meta>` section when available
- If the XML has no metadata, provide `title` and `year` as overrides

---

### GET /api/statutes/import-akn

List the authenticated user's import history. Requires researcher role or higher.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `per_page` | integer | `15` | Items per page (1-100) |
| `page` | integer | `1` | Page number |

**Example Request:**
```bash
curl "http://localhost:8000/api/statutes/import-akn" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Imports retrieved.",
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "status": "completed",
      "status_label": "Completed",
      "original_filename": "constitution.xml",
      "total_nodes": 2362,
      "processed_nodes": 2362,
      "progress": 100,
      "statute_id": 5,
      "statute_slug": "constitution-of-nigeria",
      "warnings": ["[<meta>] Could not extract year from document, using current year"],
      "options": {"country_id": 1, "title": "Constitution of Nigeria"},
      "created_at": "2026-03-16T14:00:00.000000Z",
      "updated_at": "2026-03-16T14:05:00.000000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 1,
    "last_page": 1,
    "from": 1,
    "to": 1
  }
}
```

**Notes:**
- Only shows imports created by the authenticated user
- Ordered by most recent first
- Includes statute relationship when completed

---

### GET /api/statutes/import-akn/{uuid}/status

Poll the status of a specific import. Requires researcher role or higher.

**Example Request:**
```bash
curl "http://localhost:8000/api/statutes/import-akn/a1b2c3d4-e5f6-7890-abcd-ef1234567890/status" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Response — Processing (200 OK):**
```json
{
  "success": true,
  "message": "Import status retrieved.",
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "processing",
    "status_label": "Processing",
    "original_filename": "constitution.xml",
    "total_nodes": 2362,
    "processed_nodes": 450,
    "progress": 19.1,
    "statute_id": null,
    "statute_slug": null,
    "options": {"country_id": 1},
    "created_at": "2026-03-16T14:00:00.000000Z",
    "updated_at": "2026-03-16T14:00:30.000000Z"
  }
}
```

**Response — Completed (200 OK):**
```json
{
  "success": true,
  "message": "Import status retrieved.",
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "completed",
    "status_label": "Completed",
    "original_filename": "constitution.xml",
    "total_nodes": 2362,
    "processed_nodes": 2362,
    "progress": 100,
    "statute_id": 5,
    "statute_slug": "constitution-of-nigeria",
    "warnings": null,
    "options": {"country_id": 1},
    "created_at": "2026-03-16T14:00:00.000000Z",
    "updated_at": "2026-03-16T14:05:00.000000Z"
  }
}
```

**Response — Failed (200 OK):**
```json
{
  "success": true,
  "message": "Import status retrieved.",
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "failed",
    "status_label": "Failed",
    "original_filename": "bad-file.xml",
    "total_nodes": 0,
    "processed_nodes": 0,
    "progress": 0,
    "statute_id": null,
    "statute_slug": null,
    "error_message": "Could not find body or mainBody element in the AKN document",
    "warnings": null,
    "options": {},
    "created_at": "2026-03-16T14:00:00.000000Z",
    "updated_at": "2026-03-16T14:00:05.000000Z"
  }
}
```

**Notes:**
- Users can only see their own imports (scoped by `created_by`)
- Returns 404 for non-existent UUID or another user's import
- `progress` is a computed percentage (0-100)
- `error_message` is only included when status is `failed`
- `warnings` are included on both `completed` and `failed` statuses
- Poll every 2-3 seconds for progress updates
- Progress updates in increments of ~10 nodes

---

### GET /api/statutes/{slug}/export-akn

Export a statute as Akoma Ntoso 3.0 XML. Any authenticated user can export.

**Example Request:**
```bash
curl "http://localhost:8000/api/statutes/constitution-of-nigeria/export-akn" \
  -H "Authorization: Bearer {token}" \
  -o constitution-exported.xml
```

**Response (200 OK):**
- `Content-Type: application/xml`
- `Content-Disposition: inline; filename="constitution-of-nigeria.xml"`
- Body: Valid AKN 3.0 XML document

**Notes:**
- Returns XML directly (not JSON-wrapped)
- Filename is derived from the statute slug
- Export is synchronous (fast, even for large statutes)
- The exported XML preserves full hierarchy, numbers, headings, content, intro/wrapUp text, and schedules
- `[remark]...[/remark]` markers in content are converted back to `<remark>` elements
- Inline markup (`<term>`, `<ref>`, `<def>`) that was stripped during import is not reconstructed

---

### Polling Flow

The recommended flow for importing AKN files:

```
1. POST /api/statutes/import-akn     → 202 + UUID
2. GET  .../import-akn/{uuid}/status → poll every 2-3s
3. Check response:
   - "pending"    → job queued, keep polling
   - "processing" → in progress, check `progress` %
   - "completed"  → done! use `statute_slug` to navigate
   - "failed"     → check `error_message` for details
```

---

### Statute Import Statuses

| Status | Description |
|--------|-------------|
| `pending` | Import queued, waiting for worker |
| `processing` | Worker parsing XML and creating nodes |
| `completed` | Import finished, statute available |
| `failed` | Import failed, check `error_message` |

---

## Bookmark Integration

Statutes integrate with the existing Phase 7 bookmark system. The bookmark type `statute` has been added.

### Toggle Statute Bookmark

```bash
curl -X POST "http://localhost:8000/api/bookmarks" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"type": "statute", "id": 1}'
```

**Response — Bookmark Added (201 Created):**
```json
{
  "success": true,
  "message": "Bookmark added.",
  "data": {
    "bookmarked": true,
    "bookmark": {
      "id": 2,
      "type": "statute",
      "content": {
        "id": 1,
        "title": "Constitution of the Federal Republic of Nigeria 1999",
        "short_title": "1999 Constitution",
        "slug": "constitution-of-the-federal-republic-of-nigeria-1999",
        "year": 1999,
        "status": "active",
        "is_bookmarked": true,
        "bookmarks_count": 0
      },
      "created_at": "2026-02-28T23:49:26.000000Z"
    }
  }
}
```

**Response — Bookmark Removed (200 OK):**
```json
{
  "success": true,
  "message": "Bookmark removed.",
  "data": {
    "bookmarked": false
  }
}
```

### Check Statute Bookmark Status

```bash
curl "http://localhost:8000/api/bookmarks/check?type=statute&id=1" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

### Filter Bookmarks by Statute Type

```bash
curl "http://localhost:8000/api/bookmarks?type=statute" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"
```

**Notes:**
- Bookmark `type` for statutes is `statute`
- Statute bookmarks use `StatuteSummaryResource` for the content payload
- `is_bookmarked` flag is included on all statute responses (list and show)
- `bookmarks_count` is included on statute responses
- Bookmarks are automatically cleaned up when a statute is soft-deleted

---

## Error Responses

### Common HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created successfully |
| 202 | Accepted — async import started |
| 401 | Unauthenticated |
| 403 | Forbidden — Insufficient role |
| 404 | Resource not found |
| 422 | Validation error or ambiguous path |

### 401 Unauthenticated

```json
{
  "success": false,
  "message": "Unauthenticated.",
  "errors": null
}
```

### 403 Forbidden

```json
{
  "success": false,
  "message": "Insufficient permissions. This action requires at least researcher role."
}
```

### 404 Not Found

```json
{
  "success": false,
  "message": "Resource not found.",
  "errors": null
}
```

### 422 Validation Error

```json
{
  "success": false,
  "message": "Please provide a statute title. (and 1 more error)",
  "errors": {
    "title": ["Please provide a statute title."],
    "year": ["Please provide the year of enactment."]
  }
}
```

---

## Data Models

### Statute Resource (Full)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Primary key |
| `uuid` | string | UUID |
| `title` | string | Statute title |
| `short_title` | string\|null | Short title |
| `slug` | string | URL-friendly slug |
| `preamble` | string\|null | Preamble text |
| `description` | string\|null | Description |
| `country` | object\|null | Associated country (when loaded) |
| `year` | integer | Year of enactment |
| `commencement_date` | date\|null | Commencement date |
| `status` | string | `active`, `repealed`, or `amended` |
| `status_label` | string | Human-readable status (e.g., `Active`) |
| `document_type` | string\|null | AKN document type (e.g., `act`, `bill`) |
| `frbr_uri` | string\|null | FRBR canonical URI for AKN documents |
| `creator` | object\|null | User who created the statute (when loaded) |
| `root_nodes_count` | integer | Number of top-level nodes (when counted) |
| `nodes_count` | integer | Total number of nodes (when counted) |
| `is_bookmarked` | boolean | Whether current user has bookmarked |
| `bookmarks_count` | integer | Total bookmarks from all users |
| `created_at` | datetime | ISO 8601 creation timestamp |
| `updated_at` | datetime | ISO 8601 last update timestamp |

### Statute Summary Resource (Lightweight — used in bookmarks)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Primary key |
| `title` | string | Statute title |
| `short_title` | string\|null | Short title |
| `slug` | string | URL-friendly slug |
| `year` | integer | Year of enactment |
| `status` | string | Status value |
| `is_bookmarked` | boolean | Whether current user has bookmarked |
| `bookmarks_count` | integer | Total bookmarks |

### Statute Node Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Primary key |
| `statute_id` | integer | Parent statute ID |
| `parent_id` | integer\|null | Parent node ID (null for root) |
| `node_type` | string | Node type (e.g., `chapter`, `section`) |
| `node_type_label` | string | Human-readable type (e.g., `Chapter`) |
| `number` | string\|null | Node number (e.g., `I`, `33`) |
| `title` | string\|null | Node title |
| `content` | string\|null | Node body text |
| `intro` | string\|null | Introductory text before child nodes |
| `wrap_up` | string\|null | Concluding text after child nodes |
| `slug` | string | Node slug (e.g., `section-33`) |
| `slug_path` | string | Full path (e.g., `chapter-iv/section-33`) |
| `order` | integer | Order among siblings |
| `position` | integer | DFS position (global within statute) |
| `depth` | integer | Nesting depth (0 = root) |

### Statute Import Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Public identifier (UUID exposed as `id`) |
| `status` | string | `pending`, `processing`, `completed`, or `failed` |
| `status_label` | string | Human-readable status (e.g., `Processing`) |
| `original_filename` | string | Original uploaded filename |
| `total_nodes` | integer | Total nodes found in XML |
| `processed_nodes` | integer | Nodes created so far |
| `progress` | number | Computed percentage (0-100) |
| `statute_id` | integer\|null | Created statute ID (when completed) |
| `statute_slug` | string\|null | Created statute slug (when completed) |
| `error_message` | string\|null | Error details (only when failed) |
| `warnings` | array\|null | Non-fatal warnings (when completed or failed) |
| `options` | object\|null | Import options (country_id, title, year) |
| `created_at` | datetime | ISO 8601 creation timestamp |
| `updated_at` | datetime | ISO 8601 last update timestamp |

### Valid Node Types

| Node Type | Label |
|-----------|-------|
| `act` | Act |
| `chapter` | Chapter |
| `part` | Part |
| `section` | Section |
| `subsection` | Subsection |
| `article` | Article |
| `rule` | Rule |
| `schedule` | Schedule |
| `regulation` | Regulation |
| `clause` | Clause |
| `paragraph` | Paragraph |
| `item` | Item |
| `subparagraph` | Subparagraph |
| `subpart` | Subpart |
| `subclause` | Subclause |
| `subrule` | Subrule |
| `division` | Division |
| `subdivision` | Subdivision |
| `title` | Title |
| `book` | Book |
| `point` | Point |
| `crossheading` | Cross Heading |
| `proviso` | Proviso |
| `hcontainer` | Container |

---

## Authorization Rules

### Statute Operations

| Action | Admin | Researcher | User | Guest |
|--------|-------|------------|------|-------|
| List statutes | Yes | Yes | Yes | No (401) |
| View statute | Yes | Yes | Yes | No (401) |
| Create statute | Yes | Yes | No (403) | No (401) |
| Update statute | Yes | Yes | No (403) | No (401) |
| Delete statute | Yes | Yes | No (403) | No (401) |
| Restore statute | Yes | No (403) | No (403) | No (401) |

### AKN Import/Export Operations

| Action | Admin | Researcher | User | Guest |
|--------|-------|------------|------|-------|
| Import AKN | Yes | Yes | No (403) | No (401) |
| List imports | Yes | Yes | No (403) | No (401) |
| Poll import status | Yes | Yes | No (403) | No (401) |
| Export AKN | Yes | Yes | Yes | No (401) |

### Node Operations

| Action | Admin | Researcher | User | Guest |
|--------|-------|------------|------|-------|
| Load nodes (range) | Yes | Yes | Yes | No (401) |
| Navigate (deep link) | Yes | Yes | Yes | No (401) |
| Create node | Yes | Yes | No (403) | No (401) |
| Update node | Yes | Yes | No (403) | No (401) |
| Delete node | Yes | Yes | No (403) | No (401) |

---

## Notes

### Endpoint Lookup Methods

| Operation | Lookup By | Route Parameter |
|-----------|-----------|-----------------|
| GET (list) | — | — |
| GET (show) | slug | `{statute:slug}` |
| POST (create) | — | — |
| PUT (update) | id | `{statute}` |
| DELETE | id | `{statute}` |
| POST restore | id | `{id}` |
| GET (nodes range) | slug | `{statute:slug}` |
| GET (navigate) | slug | `{statute:slug}` |
| POST (node create) | id | `{statute}` |
| PUT (node update) | id | `{statute}` |
| DELETE (node delete) | id | `{statute}` |
| POST (import AKN) | — | — |
| GET (import list) | — | — |
| GET (import status) | uuid | `{uuid}` |
| GET (export AKN) | slug | `{statute:slug}` |

### Position System (DFS)

Positions are calculated using depth-first traversal and represent the global display order of nodes within a statute:

```
Chapter I      → position 0 (depth 0)
  Section 1    → position 1 (depth 1)
  Section 2    → position 2 (depth 1)
Chapter II     → position 3 (depth 0)
  Section 33   → position 4 (depth 1)
    Subsection 1 → position 5 (depth 2)
```

- Positions are recalculated after every node add, update, or delete
- The frontend uses `from` and `to` query parameters to request a specific range
- `depth` indicates indentation level for rendering

### Slug Path System

The `slug_path` is a materialized path representing the full hierarchy:

```
Root chapter slug_path:    "chapter-i"
Child section slug_path:   "chapter-i/section-1"
Grandchild slug_path:      "chapter-i/section-1/subsection-1"
```

- Slug paths are automatically built from the parent chain on creation
- Moving a node (changing `parent_id`) cascades slug_path updates to all descendants
- The navigate endpoint resolves nodes by their slug_path for deep linking
- Suffix matching allows shortened paths (e.g., `/navigate/section-33` instead of `/navigate/chapter-iv/section-33`) when unique

### Meilisearch Integration

Each statute is indexed as a single Meilisearch document containing:
- `title`, `short_title`, `preamble`, `description`
- `country_name` (denormalized)
- `node_content` (aggregated content from all child nodes)
- Filterable: `country_id`, `status`, `year`
- Sortable: `year`, `created_at`

Node content is re-indexed when any node is created, updated, or deleted (via `StatuteNodeObserver`).

### N+1 Query Prevention

- `is_bookmarked` uses `withExists()` for user-specific bookmark status
- `bookmarks_count`, `root_nodes_count`, `nodes_count` use `withCount()`
- Country and creator relationships are eager-loaded on list and show endpoints

### Cascade Behaviors

- **Soft-delete statute:** Bookmarks are automatically deleted. Nodes are preserved.
- **Restore statute:** Statute is restored with all its nodes intact.
- **Delete node:** All descendant nodes are recursively hard-deleted. Positions recalculated.
- **Move node (parent change):** `slug_path` and `depth` cascade to all descendants.
