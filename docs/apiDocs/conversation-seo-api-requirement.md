# Backend API Change Required: Public Conversation Access Without Authentication

## Context

We've added SEO metadata and Open Graph tags to conversation pages (`/c/{id}`). When someone shares a Lawexa conversation link on social media (Twitter, LinkedIn, Facebook, WhatsApp), the platform's crawler fetches the page to render a preview card.

## The Problem

Social media crawlers **do not** carry authentication tokens. Currently, `GET /api/conversations/{id}` requires a Bearer token for all requests. This means:

- When Twitter/Facebook/LinkedIn crawl a shared link, the server-side metadata fetch fails (401)
- The share card falls back to generic "Lawexa - Nigerian Legal Resources" instead of showing the conversation title, author, and agent info

## What's Needed

**Allow unauthenticated `GET /api/conversations/{id}` for public conversations.**

### Expected behavior:

| Scenario | Auth | `is_private` | Response |
|----------|------|-------------|----------|
| Public conversation, no token | No | `false` | **200** — return conversation data (title, author, agent, counts) |
| Public conversation, with token | Yes | `false` | 200 — return full data as usual |
| Private conversation, no token | No | `true` | **403** or **401** |
| Private conversation, with token (owner) | Yes | `true` | 200 — return full data |
| Non-existent conversation | Any | N/A | **404** |

### Minimum fields needed for SEO (unauthenticated response):

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Conversation title",
    "is_private": false,
    "messages_count": 12,
    "views_count": 45,
    "author": {
      "id": 1,
      "name": "Author Name",
      "avatar_url": null
    },
    "agent": {
      "id": 1,
      "name": "Agent Name",
      "slug": "agent-slug"
    },
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

> **Note:** For security, the unauthenticated response can **exclude** the `messages` array entirely. We only need the header/metadata fields listed above.

## Priority

This is required for the SEO and social sharing features to work. Without this change, shared conversation links will show generic metadata instead of the actual conversation title and details.
