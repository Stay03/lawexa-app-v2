# Phase 2: AI Models (CRUD)

## Goal

Build model management. Models depend on Providers (foreign key `provider_id`), so forms need a provider dropdown.

---

## Route Structure

```
/admin/ai/models          → List all models
/admin/ai/models/[id]     → Model detail
```

---

## List Page Design

**Page:** `app/(admin)/admin/ai/models/page.tsx`

Same structure as Providers list. Key differences in filters and table columns.

### Filter Bar (`AiModelFilters.tsx`)

| Filter | Type | Notes |
|--------|------|-------|
| Provider | Select dropdown | Populated by `useAiProviders({ per_page: 100 })`, maps to `provider_id` |
| Vision | Select (All / Yes / No) | Maps to `supports_vision` |
| Streaming | Select (All / Yes / No) | Maps to `supports_streaming` |
| Per page | Select (10 / 15 / 25 / 50) | |

### Data Table (`AiModelsTable.tsx`)

| Column | Sortable | Display |
|--------|----------|---------|
| Name | Yes (`name`) | Font medium |
| Model ID | No | `font-mono text-xs`, Tooltip for full ID |
| Provider | No | Provider name as clickable link to `/admin/ai/providers/[id]` |
| Input $/1M | Yes (`input_price_per_1m`) | `font-mono tabular-nums`, 4 decimal places |
| Output $/1M | Yes (`output_price_per_1m`) | Same formatting |
| Context | Yes (`max_context_tokens`) | Formatted as "128K", "200K" |
| Vision | No | `CheckCircle` (green) or `XCircle` (muted) icons |
| Streaming | No | Same icon pattern |
| Created | Yes (`created_at`) | `formatDistanceToNow` |
| Actions | No | DropdownMenu (Edit, Delete) |

---

## Create/Edit Form Design

**Component:** `AiModelFormSheet.tsx`

Uses `Sheet` (side="right") -- 8 fields, needs more space than a Dialog.

| Field | Type | Notes |
|-------|------|-------|
| Provider | Select dropdown | Populated by `useAiProviders({ per_page: 100 })`, shows only active providers. **This is the key dependency chain UI.** |
| Name | Input text | Display name |
| Model ID | Input text | Provider-specific identifier (e.g., `openai/gpt-4o`) |
| Input Price/1M | Input number | `step="0.0001"`, `min="0"` |
| Output Price/1M | Input number | Same |
| Max Context Tokens | Input number | `min="1000"` |
| Supports Vision | Switch | Default false |
| Supports Streaming | Switch | Default false |

### Dependency Chain UI Pattern

When the Provider select has no active providers:
- Show helper text: "No active providers found. Create a provider first."
- Optionally link to `/admin/ai/providers`

This pattern repeats for all dependent resources (Agents need Models, Workflows need Agents).

---

## Detail Page Design

**Page:** `app/(admin)/admin/ai/models/[id]/page.tsx`

### Layout

```
Back button → "Back to Models"

Model Info Card
  CardHeader → Model name + Model ID in description
  Top right → Actions dropdown (Edit, Delete)
  CardContent → Grid of all properties:
    Provider (link), Pricing, Context window, Vision, Streaming, Created, Updated

Provider Link Card (small)
  Shows parent provider name with link to provider detail
```

---

## Delete Confirmation

**Component:** `AiModelDeleteDialog.tsx`

Simple confirmation -- "Are you sure you want to delete '{model.name}'?"

The API may return a 422 if the model has agents. If so, show `toast.error` with the API message.

---

## Files

| Action | File | Purpose |
|--------|------|---------|
| Create | `components/admin/ai/AiModelFilters.tsx` | Filter bar with provider dropdown |
| Create | `components/admin/ai/AiModelsTable.tsx` | Data table with pricing/capability columns |
| Create | `components/admin/ai/AiModelFormSheet.tsx` | Create/edit Sheet form |
| Create | `components/admin/ai/AiModelDeleteDialog.tsx` | Delete confirmation |
| Create | `app/(admin)/admin/ai/models/page.tsx` | List page |
| Create | `app/(admin)/admin/ai/models/[id]/page.tsx` | Detail page |
