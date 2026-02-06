# Admin AI Management - Implementation Overview

## Summary

Full CRUD admin interface for managing the AI infrastructure: **Providers, Models, Agents, Tools, and Workflows**. Built on top of the existing admin area patterns with shadcn/ui components.

**API Docs Reference:** `docs/apiDocs/admin-ai-docs.md`

---

## Implementation Order

```
Phase 0: Foundation (types, API, hooks, sidebar nav)
    ↓
Phase 1: AI Providers (simplest, no dependencies)
    ↓
Phase 2: AI Models (depends on Providers)
    ↓
Phase 3: AI Agents (depends on Models)
    ↓
Phase 4: AI Tools ─────┐ (can run in parallel)
Phase 5: AI Workflows ─┘
```

### Why This Order?

Follows the **dependency chain**: Providers → Models → Agents → Tools/Workflows

Each phase's forms need dropdown selectors populated by the previous phase's resources. Building in order ensures the parent resources and their hooks exist before the child forms need them.

---

## File Organization

### New Files by Layer

```
types/
  admin-ai.ts                          ← All interfaces for 5 resources

lib/
  validations/admin-ai.ts              ← Zod schemas (create + update per resource)
  api/admin-ai.ts                      ← API client (~25 methods)
  hooks/useAdminAi.ts                  ← React Query hooks (~30 hooks)

components/admin/
  admin-nav-ai.tsx                     ← Sidebar AI Management section
  ai/
    AiProviderFilters.tsx              ← Phase 1
    AiProvidersTable.tsx
    AiProviderFormDialog.tsx
    AiProviderDeleteDialog.tsx
    AiProviderTestButton.tsx
    AiModelFilters.tsx                 ← Phase 2
    AiModelsTable.tsx
    AiModelFormSheet.tsx
    AiModelDeleteDialog.tsx
    AiAgentFilters.tsx                 ← Phase 3
    AiAgentsTable.tsx
    AiAgentFormSheet.tsx
    AiAgentDeleteDialog.tsx
    AiToolFilters.tsx                  ← Phase 4
    AiToolsTable.tsx
    AiToolFormSheet.tsx
    AiToolDeleteDialog.tsx
    AiToolAgentManager.tsx
    AiWorkflowFilters.tsx              ← Phase 5
    AiWorkflowsTable.tsx
    AiWorkflowFormSheet.tsx
    AiWorkflowDeleteDialog.tsx

app/(admin)/admin/ai/
  providers/
    page.tsx                           ← List
    [id]/page.tsx                      ← Detail
  models/
    page.tsx
    [id]/page.tsx
  agents/
    page.tsx
    [id]/page.tsx
  tools/
    page.tsx
    [id]/page.tsx
  workflows/
    page.tsx
    [id]/page.tsx
```

### Modified Files

| File | Change |
|------|--------|
| `components/admin/admin-sidebar.tsx` | Add AI Management nav section |
| `components/admin/AdminPagination.tsx` | Add `itemLabel` prop |

---

## UI/UX Decisions

### Form Containers

| Resource | Container | Reason |
|----------|-----------|--------|
| Provider | **Dialog** (max-w-425px) | 5 fields, simple form |
| Model | **Sheet** (right, max-w-lg) | 8 fields with number inputs |
| Agent | **Sheet** (right, max-w-lg) | 8 fields with textareas |
| Tool | **Sheet** (right, max-w-xl) | 11 fields + JSON editor |
| Workflow | **Sheet** (right, max-w-2xl) | Dynamic agent array builder |

### Status Indicators

- **Active/Inactive**: Badge `variant="default"` vs `variant="secondary"`
- **HTTP Methods**: Color-coded badges (GET=blue, POST=green, PUT=amber, DELETE=red)
- **Execution Mode**: Badge `simple`=outline, `react`=default
- **Workflow Roles**: `primary`=default, `specialist`=outline, `fallback`=secondary
- **Boolean capabilities** (vision, streaming, auth): CheckCircle/XCircle icons
- **Default workflow**: Star icon (filled vs outline)

### Error Handling Strategy

| Error Type | Handling |
|------------|----------|
| Validation errors (422 with `errors` object) | Map field errors to form via `form.setError()` for inline feedback |
| Business logic errors (422 with `message` only, `errors: null`) | Show via `toast.error(message)` |
| Network errors | Generic `toast.error('Something went wrong')` |

### Delete Guards

| Resource | Guard Condition | Behavior |
|----------|----------------|----------|
| Provider | `models_count > 0` | Warning about cascade, still allows delete |
| Agent | `conversations_count > 0` | Delete button **disabled**, suggest deactivating |
| Tool | `agents_count > 0` | Delete button **disabled**, must detach first |
| Workflow | `is_default === true` | Delete button **disabled**, must change default first |
| Workflow | `conversations_count > 0` | Delete button **disabled**, suggest deactivating |

### Auto-slug Generation

On create forms: typing in `name` auto-populates `slug` (lowercase, spaces→dashes, strip special chars). Stops auto-generating once user manually edits the slug. Tracked with `slugManuallyEdited` state.

### Dependency Chain in Forms

When a child form needs a parent resource dropdown (e.g., Model form needs Provider):
- Populated by fetching parent with `per_page: 100` (acceptable for admin use)
- Shows only active parents
- If no active parents exist: Helper text "No active {parents} found. Create one first." with link

---

## Patterns to Reuse

| Pattern | Reference File |
|---------|---------------|
| API client methods | `lib/api/admin.ts` |
| React Query hooks + key factory | `lib/hooks/useAdmin.ts` |
| List page (Suspense, URL state, filters+table+pagination) | `app/(admin)/admin/conversations/page.tsx` |
| Filter bar component | `components/admin/AdminConversationFilters.tsx` |
| Data table (SortButton, Skeleton, empty state, badges) | `components/admin/AdminConversationsTable.tsx` |
| Pagination | `components/admin/AdminPagination.tsx` |
| Detail page (back button, breadcrumb override) | `app/(admin)/admin/conversations/[id]/page.tsx` |
| Sidebar navigation | `components/admin/admin-nav-main.tsx` |

---

## Totals

- **35 new files** created
- **2 existing files** modified
- **~25 API methods**
- **~30 React Query hooks**
- **10 pages** (5 list + 5 detail)
- **22 components** (filters, tables, forms, dialogs, special)
