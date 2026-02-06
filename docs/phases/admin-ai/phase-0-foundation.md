# Phase 0: Foundation - Types, API, Hooks, Navigation

## Goal

Create all shared infrastructure (types, API layer, hooks, sidebar nav) before any UI work. Every subsequent phase depends on this.

---

## Architecture

### Dependency Chain

```
AI Providers
  └── AI Models (provider_id → providers.id)
        └── AI Agents (model_id → models.id)
              ├── AI Tools (many-to-many via ai_agent_tools)
              └── AI Workflows (many-to-many via ai_workflow_agents with role/order)
```

### Layer Structure (mirrors existing admin patterns)

```
types/admin-ai.ts          → TypeScript interfaces for all 5 resources
lib/validations/admin-ai.ts → Zod schemas for create/update forms
lib/api/admin-ai.ts         → API client methods (~25 methods)
lib/hooks/useAdminAi.ts     → React Query hooks (~30 hooks)
```

---

## Design Notes

### Types (`types/admin-ai.ts`)

- One set of interfaces per resource: list item, detail, params, create data, update data, list response, detail response, mutation response
- Reuse `AdminConversationsPagination` and `AdminConversationsLinks` from `types/admin.ts` -- the pagination shape is identical across all endpoints
- Prices come as strings from API (e.g., `"3.0000"`) -- type as `string`, parse in UI
- The `system_prompt` field on Agents is write-only (accepted on create/update, never returned in responses)
- Workflow agents include pivot data: `role` (`primary` | `specialist` | `fallback`) and `order` (number)
- The `api_key` field on Providers is never exposed in responses

### Validations (`lib/validations/admin-ai.ts`)

- Shared slug regex: `/^[a-z0-9-_]+$/` for all slug fields
- Provider: `api_key` required on create, optional on update
- Tool: `parameters` field validated as JSON string with `type: "object"` (parsed in refine)
- Workflow: Custom `.refine()` to enforce "exactly one agent must have the primary role"
- All update schemas are `.partial()` versions of create schemas

### API Layer (`lib/api/admin-ai.ts`)

- Follows exact pattern from `lib/api/admin.ts`: object literal, `apiClient.get/post/put/delete`, typed generics
- ~25 methods: 5 resources x CRUD (get list, get detail, create, update, delete) + special operations
- Special operations: `testProvider(id)`, `attachToolToAgent(toolId, agentId)`, `detachToolFromAgent(toolId, agentId)`
- Default params applied inline (e.g., `page ?? 1`, `per_page ?? 15`, `sort_by ?? 'name'`)

### Hooks (`lib/hooks/useAdminAi.ts`)

- Key factory pattern matching `lib/hooks/useAdmin.ts`: `adminAiKeys = { all: ['admin', 'ai'], providers: () => ..., providersList: (params) => ..., providerDetail: (id) => ... }`
- All query hooks use `staleTime: 30 * 1000` (30 seconds)
- Detail hooks use `enabled: !!id`
- Mutation hooks call `queryClient.invalidateQueries` on both list and detail keys
- Toasts are NOT in hooks -- handled at the call site (component level)
- ~30 hooks total across all resources

### Sidebar Navigation

**New file:** `components/admin/admin-nav-ai.tsx`

- Collapsible group using `Collapsible` + `SidebarMenuSub` from existing shadcn sidebar components
- Group icon: `Brain` from lucide-react
- Sub-items: Providers, Models, Agents, Tools, Workflows (each with its own icon)
- Active route detection via `pathname.startsWith(url)`

**Modify:** `components/admin/admin-sidebar.tsx`

- Import and render `<AdminNavAiSection />` after `<AdminNavMain />` inside `SidebarContent`

### AdminPagination Enhancement

**Modify:** `components/admin/AdminPagination.tsx`

- Add optional `itemLabel?: string` prop (defaults to `"items"` for backward compat)
- AI pages pass resource-specific labels: `"providers"`, `"models"`, etc.

---

## Files

| Action | File | Purpose |
|--------|------|---------|
| Create | `types/admin-ai.ts` | All TypeScript interfaces |
| Create | `lib/validations/admin-ai.ts` | All Zod schemas |
| Create | `lib/api/admin-ai.ts` | API client methods (~25) |
| Create | `lib/hooks/useAdminAi.ts` | React Query hooks (~30) |
| Create | `components/admin/admin-nav-ai.tsx` | Collapsible AI nav section |
| Modify | `components/admin/admin-sidebar.tsx` | Render new AI nav |
| Modify | `components/admin/AdminPagination.tsx` | Add `itemLabel` prop |
