# Phase 1: AI Providers (CRUD + Test API Key)

## Goal

Build the first and simplest resource -- AI Providers. No foreign key dependencies. This establishes the CRUD pattern reused by all subsequent phases.

---

## Route Structure

```
/admin/ai/providers          → List all providers (table + filters + pagination)
/admin/ai/providers/[id]     → Provider detail (info card + models table)
```

---

## List Page Design

**Page:** `app/(admin)/admin/ai/providers/page.tsx`

Follows the exact structure of `app/(admin)/admin/conversations/page.tsx`:
- `'use client'` with `Suspense` wrapper + Skeleton fallback
- URL state management via `useSearchParams()` + `useRouter()`
- `useMemo` to derive `AiProviderParams` from search params
- `useAiProviders(params)` hook for data fetching
- `updateParams` callback for filter/sort/page changes

### Layout

```
Card
  CardHeader → Title "AI Providers" + "Add Provider" button (top right)
  CardContent →
    AiProviderFilters (filter bar)
    AiProvidersTable (data table)
    AdminPagination (reuse existing, pass itemLabel="providers")

AiProviderFormDialog (create/edit - opened via state)
AiProviderDeleteDialog (delete confirmation - opened via state)
```

### Filter Bar (`AiProviderFilters.tsx`)

- **Status filter**: Select (All / Active / Inactive) → maps to `active_only` param
- **Per page selector**: Select (10 / 15 / 25 / 50)
- Pattern matches `AdminConversationFilters.tsx` exactly
- Props: `{ params, onParamsChange }`

### Data Table (`AiProvidersTable.tsx`)

| Column | Sortable | Display |
|--------|----------|---------|
| Name | Yes (`name`) | Font medium, truncate |
| Slug | No | `font-mono text-xs text-muted-foreground` |
| Base URL | No | Truncated with Tooltip for full URL |
| Status | No | Badge: active = `default`, inactive = `secondary` |
| Models | No | `models_count` with `tabular-nums` |
| Created | Yes (`created_at`) | `formatDistanceToNow` with Tooltip for full date |
| Actions | No | DropdownMenu (Edit, Test API Key, Delete) |

- Clickable rows navigate to `/admin/ai/providers/[id]`
- Loading state: Skeleton rows (same pattern as `AdminConversationsTable`)
- Empty state: Centered muted text "No providers found"
- `SortButton` inline component matching conversations table pattern

---

## Detail Page Design

**Page:** `app/(admin)/admin/ai/providers/[id]/page.tsx`

Follows `app/(admin)/admin/conversations/[id]/page.tsx` pattern.

### Layout

```
Back button → "Back to Providers"

Provider Info Card
  CardHeader → Name + Slug/ID in description
  Top right → Status Badge + Test API Key button + Actions dropdown (Edit, Delete)
  CardContent → Grid: Base URL, Models count, Created, Updated

Models Card
  CardHeader → "Models ({count})"
  CardContent →
    If 0 models: Empty state "No models configured for this provider"
    If has models: Simple table (Name, Model ID, Pricing, Context, Vision, Streaming)
    Clickable rows link to /admin/ai/models/[id]
```

Uses `useBreadcrumbStore` to set provider name as breadcrumb label.

---

## Create/Edit Form Design

**Component:** `AiProviderFormDialog.tsx`

Uses `Dialog` (not Sheet) -- only 5 fields, compact form.

| Field | Type | Notes |
|-------|------|-------|
| Name | Input text | Required, max 255 |
| Slug | Input text | Auto-generated from name on create, stops when manually edited |
| Base URL | Input url | Required, must be valid URL |
| API Key | Input password | Required on create, optional on update |
| Active | Switch | Defaults to true |

### Auto-slug behavior

On create mode only: typing in `name` auto-populates `slug` (lowercase, spaces → dashes, strip special chars). Stops auto-generating once user manually types in slug field. Tracked with `slugManuallyEdited` state.

### Error Handling

- **Validation errors** (422 with `errors` object): Map each field error to form using `form.setError(field, { message })` for inline feedback
- **Business logic errors** (422 with `message` only): Show via `toast.error(message)`
- **Network errors**: Generic `toast.error('Something went wrong')`

### Mutation Flow

- Create: `useCreateAiProvider` → on success: `toast.success`, close dialog
- Edit: `useUpdateAiProvider` → on success: `toast.success`, close dialog
- Both: on error: extract API field errors → `form.setError()`

---

## Delete Confirmation Design

**Component:** `AiProviderDeleteDialog.tsx`

Uses `AlertDialog` from shadcn.

- If `models_count > 0`: Warning text about cascade deletion of models/agents. Still allows delete (API handles cascade).
- If `models_count === 0`: Simple "Are you sure?" confirmation
- On API error (e.g., "Cannot delete provider with existing models"): Show error via `toast.error(message)`
- Delete button: destructive variant, disabled while pending

---

## Test API Key Design

**Component:** `AiProviderTestButton.tsx`

Standalone button usable in both table actions menu and detail page.

- Triggers `useTestAiProvider` mutation → `POST /ai-providers/{id}/test`
- While testing: Loader spinner
- On success (`data.success: true`): `toast.success("Connection successful ({response_time_ms}ms)")`
- On failure (`data.success: false`): `toast.error(data.error || "Connection failed")`

---

## Files

| Action | File | Purpose |
|--------|------|---------|
| Create | `components/admin/ai/AiProviderFilters.tsx` | Filter bar |
| Create | `components/admin/ai/AiProvidersTable.tsx` | Data table |
| Create | `components/admin/ai/AiProviderFormDialog.tsx` | Create/edit dialog |
| Create | `components/admin/ai/AiProviderDeleteDialog.tsx` | Delete confirmation |
| Create | `components/admin/ai/AiProviderTestButton.tsx` | Test API key action |
| Create | `app/(admin)/admin/ai/providers/page.tsx` | List page |
| Create | `app/(admin)/admin/ai/providers/[id]/page.tsx` | Detail page |
