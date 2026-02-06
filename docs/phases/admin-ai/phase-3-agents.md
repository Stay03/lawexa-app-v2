# Phase 3: AI Agents (CRUD)

## Goal

Build agent management. Agents depend on Models (foreign key `model_id`). Agents have a system prompt (write-only) and conversation counts that affect delete behavior.

---

## Route Structure

```
/admin/ai/agents          → List all agents
/admin/ai/agents/[id]     → Agent detail
```

---

## List Page Design

### Filter Bar (`AiAgentFilters.tsx`)

| Filter | Type | Notes |
|--------|------|-------|
| Model | Select dropdown | Populated by `useAiModels({ per_page: 100 })` |
| Active | Select (All / Active / Inactive) | Maps to `active_only` |
| Per page | Select | |

### Data Table (`AiAgentsTable.tsx`)

| Column | Sortable | Display |
|--------|----------|---------|
| Name | Yes (`name`) | Font medium |
| Slug | No | `font-mono text-xs text-muted-foreground` |
| Model | No | Model name as clickable link |
| Temperature | Yes (`temperature`) | `font-mono tabular-nums` |
| Max Tokens | No | Formatted number |
| Status | No | Badge (active/inactive) |
| Conversations | No | `conversations_count` with `tabular-nums` |
| Created | Yes (`created_at`) | `formatDistanceToNow` |
| Actions | No | DropdownMenu (Edit, Delete) |

---

## Create/Edit Form Design

**Component:** `AiAgentFormSheet.tsx`

Uses `Sheet` (side="right", max-w-lg) -- 8 fields including textareas.

| Field | Type | Notes |
|-------|------|-------|
| Model | Select dropdown | From `useAiModels({ per_page: 100 })`. Display format: "ModelName (ProviderName)" for clarity |
| Name | Input text | Required |
| Slug | Input text | Auto-slug from name on create |
| Description | Textarea | Optional, for display purposes |
| System Prompt | Textarea (large) | Required. `min-h-[120px]`. This is write-only -- not returned in API responses |
| Temperature | Input number | `min="0"` `max="2"` `step="0.01"`, default 0.7 |
| Max Response Tokens | Input number | `min="100"` `max="32000"`, default 2048 |
| Active | Switch | Default true |

### System Prompt Handling

- On **create**: Empty textarea, required
- On **edit**: Textarea shows placeholder "System prompt is set but not displayed for security. Leave empty to keep current, or enter a new prompt to replace it."
- Validation: Required on create, optional on update

---

## Detail Page Design

**Page:** `app/(admin)/admin/ai/agents/[id]/page.tsx`

### Layout

```
Back button → "Back to Agents"

Agent Info Card
  CardHeader → Agent name + Slug/Description
  Top right → Status Badge + Actions dropdown (Edit, Delete)
  CardContent → Grid:
    Temperature, Max Response Tokens, Conversations count, Created, Updated

Model & Provider Card
  Shows linked model name + provider name (both as links to their detail pages)
  Model pricing info (input/output per 1M), context window

Note about system prompt
  Small muted text: "System prompt is configured but not displayed in the admin interface."
```

---

## Delete Confirmation Design

**Component:** `AiAgentDeleteDialog.tsx`

This has special business logic:

- If `conversations_count > 0`:
  - Warning: "This agent has {n} conversation(s). You cannot delete an agent with existing conversations."
  - Suggest: "Consider deactivating the agent instead."
  - **Delete button is disabled** (not just warned)
- If `conversations_count === 0`:
  - Simple confirmation: "Are you sure?"
  - Delete button enabled

On API error: `toast.error(message)` (e.g., "Cannot delete agent with existing conversations. Archive the agent instead.")

---

## Files

| Action | File | Purpose |
|--------|------|---------|
| Create | `components/admin/ai/AiAgentFilters.tsx` | Filter bar with model dropdown |
| Create | `components/admin/ai/AiAgentsTable.tsx` | Data table |
| Create | `components/admin/ai/AiAgentFormSheet.tsx` | Create/edit Sheet with system prompt |
| Create | `components/admin/ai/AiAgentDeleteDialog.tsx` | Delete with conversation guard |
| Create | `app/(admin)/admin/ai/agents/page.tsx` | List page |
| Create | `app/(admin)/admin/ai/agents/[id]/page.tsx` | Detail page |
