# Phase 5: AI Workflows (CRUD with Dynamic Agent Array)

## Goal

Build workflow management -- the most complex resource. Workflows contain agents with pivot data (role + order) and have the most complex form UI with a dynamic array builder.

**Can be implemented in parallel with Phase 4 (Tools).**

---

## Route Structure

```
/admin/ai/workflows          → List all workflows
/admin/ai/workflows/[id]     → Workflow detail
```

---

## List Page Design

### Filter Bar (`AiWorkflowFilters.tsx`)

| Filter | Type | Notes |
|--------|------|-------|
| Active | Select (All / Active / Inactive) | Maps to `active_only` |
| Per page | Select | |

### Data Table (`AiWorkflowsTable.tsx`)

| Column | Sortable | Display |
|--------|----------|---------|
| Name | Yes (`name`) | Font medium |
| Slug | No | `font-mono text-xs` |
| Execution Mode | No | Badge: `simple` = outline, `react` = default |
| Default | Yes (`is_default`) | Star icon: filled for default, outline for non-default |
| Status | No | Badge (active/inactive) |
| Agents | No | Count + hover preview of agent names (Tooltip) |
| Conversations | No | `conversations_count` with `tabular-nums` |
| Created | Yes (`created_at`) | `formatDistanceToNow` |
| Actions | No | DropdownMenu (Edit, Delete) |

---

## Create/Edit Form Design

**Component:** `AiWorkflowFormSheet.tsx`

Uses `Sheet` (side="right", max-w-2xl) -- the widest form, needed for the agent array builder.

### Static Fields

| Field | Type | Notes |
|-------|------|-------|
| Name | Input text | Required |
| Slug | Input text | Auto-slug from name on create |
| Description | Textarea | Optional |
| Execution Mode | Select | `simple` or `react` |
| Orchestrator Agent | Select dropdown | From `useAiAgents({ per_page: 100 })`, optional |
| Is Default | Switch | Warning text: "Setting this as default will unset the current default workflow" |
| Active | Switch | Default true |

### Dynamic Agent Array Builder

This is the most complex UI piece. Uses `useFieldArray` from React Hook Form.

**Design:**

```
Label: "Workflow Agents"
Helper text: "Assign agents with roles and execution order. Exactly one agent must have the 'primary' role."

For each agent row (in a bordered rounded container):
  [Order #]  [Agent Select ▼]  [Role Select ▼]  [Order Input]  [Remove ✕]

[+ Add Agent] button at bottom
```

**Each row contains:**
- **Order indicator**: Visual index `#1`, `#2`, etc. (read-only display)
- **Agent select**: Dropdown from `useAiAgents({ per_page: 100 })`, shows agent name
- **Role select**: `primary` | `specialist` | `fallback`
- **Order input**: Number input, `min="0"`
- **Remove button**: Trash icon, removes row from array

**"Add Agent" button**: Appends a new row with defaults `{ agent_id: 0, role: 'specialist', order: fields.length }`

### Validation Feedback

The Zod schema has a `.refine()` for "exactly one primary role". When validation fails:
- The entire agents section shows the error message below
- Highlight which rows have issues (e.g., no primary, multiple primaries)

### Edit Mode

On edit, the form pre-populates with existing agents from the workflow. The agents array syncs (replaces) all assignments on submit.

---

## Detail Page Design

**Page:** `app/(admin)/admin/ai/workflows/[id]/page.tsx`

### Layout

```
Back button → "Back to Workflows"

Workflow Info Card
  CardHeader → Workflow name + Slug in description
  Top right → Status Badge + Default badge (star) + Actions dropdown
  CardContent → Grid:
    Execution Mode (badge), Is Default, Conversations count, Created, Updated

Orchestrator Agent Card (if set)
  Shows orchestrator agent name + link to agent detail

Workflow Agents Card
  CardHeader → "Agents ({count})"
  CardContent → Table:
    | Order | Agent Name (link) | Role (badge) | Model | Status |

  Role badges: primary = default, specialist = outline, fallback = secondary
  Agent names link to /admin/ai/agents/[id]
  Model names link to /admin/ai/models/[id]
```

---

## Delete Confirmation Design

**Component:** `AiWorkflowDeleteDialog.tsx`

Three possible states:

1. **Is default workflow** (`is_default === true`):
   - Message: "This is the default workflow and cannot be deleted. Change the default to another workflow first."
   - Delete button **disabled**

2. **Has conversations** (`conversations_count > 0`):
   - Message: "This workflow has {n} conversation(s) and cannot be deleted. Consider deactivating it instead."
   - Delete button **disabled**

3. **Can delete** (not default, no conversations):
   - Simple confirmation
   - Delete button enabled

---

## Enums Reference

### Execution Mode

| Value | Description |
|-------|-------------|
| `simple` | Single LLM call with no iteration |
| `react` | Reasoning + Acting loop with tool calls and iterations |

### Agent Role (Pivot)

| Value | Description |
|-------|-------------|
| `primary` | Primary agent -- exactly one per workflow, required |
| `specialist` | Specialist agent for specific tasks |
| `fallback` | Fallback agent used when primary fails |

---

## Files

| Action | File | Purpose |
|--------|------|---------|
| Create | `components/admin/ai/AiWorkflowFilters.tsx` | Filter bar |
| Create | `components/admin/ai/AiWorkflowsTable.tsx` | Data table with role/mode badges |
| Create | `components/admin/ai/AiWorkflowFormSheet.tsx` | Create/edit Sheet with dynamic agent array |
| Create | `components/admin/ai/AiWorkflowDeleteDialog.tsx` | Delete with default/conversation guards |
| Create | `app/(admin)/admin/ai/workflows/page.tsx` | List page |
| Create | `app/(admin)/admin/ai/workflows/[id]/page.tsx` | Detail page with agents table |
