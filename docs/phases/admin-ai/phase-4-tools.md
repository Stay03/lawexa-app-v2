# Phase 4: AI Tools (CRUD + Agent Attach/Detach)

## Goal

Build tool management with the many-to-many agent attachment system. Tools are independent of the Provider→Model→Agent chain but connect to Agents via attach/detach endpoints.

**Can be implemented in parallel with Phase 5 (Workflows).**

---

## Route Structure

```
/admin/ai/tools          → List all tools
/admin/ai/tools/[id]     → Tool detail (includes agent attachment manager)
```

---

## List Page Design

### Filter Bar (`AiToolFilters.tsx`)

| Filter | Type | Notes |
|--------|------|-------|
| Category | Select | Known categories: "cases", "notes", "lawyers", "testing", or typed input |
| Active | Select (All / Active / Inactive) | Maps to `active_only` |
| Per page | Select | |

### Data Table (`AiToolsTable.tsx`)

| Column | Sortable | Display |
|--------|----------|---------|
| Display Name | Yes (`display_name`) | Font medium |
| Name | Yes (`name`) | `font-mono text-xs` (the snake_case identifier) |
| Category | Yes (`category`) | Badge `variant="outline"` |
| HTTP Method | No | Color-coded Badge: GET=blue, POST=green, PUT=amber, DELETE=red |
| Endpoint | No | `font-mono text-xs`, truncated with Tooltip |
| Timeout | No | Formatted as `"{n}s"` |
| Auth | No | CheckCircle or XCircle icon |
| Status | No | Badge (active/inactive) |
| Agents | No | `agents_count` |
| Created | Yes (`created_at`) | `formatDistanceToNow` |
| Actions | No | DropdownMenu (Edit, Delete) |

---

## Create/Edit Form Design

**Component:** `AiToolFormSheet.tsx`

Uses `Sheet` (side="right", max-w-xl) -- 11 fields, most complex form so far.

| Field | Type | Notes |
|-------|------|-------|
| Name | Input text | snake_case identifier, alpha_dash validation |
| Display Name | Input text | Human-readable name |
| Description | Textarea | Required, used for LLM context |
| Category | Input text | Optional, max 50 chars |
| Endpoint URL | Input text | Required, max 500 |
| HTTP Method | Select | GET, POST, PUT, PATCH, DELETE |
| Parameters | Textarea (code) | JSON Schema format. Validated as valid JSON with `type: "object"` |
| Timeout (seconds) | Input number | 5-120, default 30 |
| Retry Count | Input number | 0-5, default 0 |
| Requires Auth | Switch | Default true |
| Active | Switch | Default true |

### Parameters JSON Field

- Textarea styled for code: `font-mono text-xs`, larger height
- Validation: Must be valid JSON, must have `type: "object"` at root
- Helper text below: "JSON Schema format. Define the tool's input parameters."
- On validation error: Show parse error message below textarea
- On edit: Pre-populated with `JSON.stringify(parameters, null, 2)` for readable formatting

---

## Detail Page Design

**Page:** `app/(admin)/admin/ai/tools/[id]/page.tsx`

### Layout

```
Back button → "Back to Tools"

Tool Info Card
  CardHeader → Display Name + Name (mono) in description
  Top right → Status Badge + Category Badge + Actions dropdown
  CardContent → Grid:
    HTTP Method (color badge), Endpoint URL, Timeout, Retry, Auth Required, Created, Updated

Parameters Card
  CardHeader → "Parameters Schema"
  CardContent → Formatted JSON in <pre> block (bg-muted, rounded, monospace, text-xs, overflow-auto)

Agent Attachment Manager Card (AiToolAgentManager.tsx)
  CardHeader → "Assigned Agents ({agents_count})"
  CardContent → See below
```

---

## Agent Attachment Manager

**Component:** `AiToolAgentManager.tsx`

This is the unique UI for the tool-agent many-to-many relationship.

### Currently Assigned Agents

Table of agents currently attached to this tool (from `tool.agents` on detail response):

| Column | Display |
|--------|---------|
| Agent Name | Font medium |
| Slug | `font-mono text-xs` |
| Status | Badge (active/inactive) |
| Detach | Button with X icon, triggers `useDetachToolFromAgent` |

### Attach New Agent

Below the table, separated by a Separator:

- Select dropdown populated by `useAiAgents({ per_page: 100, active_only: true })`, **filtered to exclude already-attached agents**
- "Attach" button triggers `useAttachToolToAgent`
- On success: `toast.success("Tool attached to agent successfully")`, refetch tool detail
- On already-attached error: `toast.error("Tool is already assigned to this agent")`
- On detach success: `toast.success("Tool detached from agent successfully")`, refetch

Both attach/detach invalidate `adminAiKeys.toolDetail(id)` and `adminAiKeys.tools()`.

---

## Delete Confirmation Design

**Component:** `AiToolDeleteDialog.tsx`

- If `agents_count > 0`: Warning "This tool is assigned to {n} agent(s). Remove it from all agents before deleting." Delete button **disabled**.
- If `agents_count === 0`: Simple confirmation
- On API error: `toast.error(message)`

---

## Files

| Action | File | Purpose |
|--------|------|---------|
| Create | `components/admin/ai/AiToolFilters.tsx` | Filter bar with category filter |
| Create | `components/admin/ai/AiToolsTable.tsx` | Data table with HTTP method badges |
| Create | `components/admin/ai/AiToolFormSheet.tsx` | Create/edit Sheet with JSON editor |
| Create | `components/admin/ai/AiToolDeleteDialog.tsx` | Delete with agent guard |
| Create | `components/admin/ai/AiToolAgentManager.tsx` | Attach/detach agents on detail page |
| Create | `app/(admin)/admin/ai/tools/page.tsx` | List page |
| Create | `app/(admin)/admin/ai/tools/[id]/page.tsx` | Detail page with agent manager |
