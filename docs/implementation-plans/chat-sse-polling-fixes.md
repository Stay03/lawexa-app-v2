# Chat SSE vs Polling Rendering Fixes

## Backend Note: SSE `response_preview` Truncation

The `handover_complete` SSE event sends a `response_preview` field that is **truncated** — it cuts off mid-sentence. Example from a real stream:

```
"response_preview": "## RESEARCH SUMMARY\n\n**Topic:** Definition of \"native\"... \"indigene state "
```

This is the **only** source of sub-agent response content during live streaming. The frontend stores it as `handoverResultContent` and shows it under the "View agent response" toggle. Users currently see a broken, truncated preview.

**Request**: Send the **full** sub-agent response text in the `handover_complete` event's `response_preview` field (or rename it to `response`/`full_response`). The frontend already renders whatever it receives — no frontend changes needed for this.

---

## Frontend Fixes (no backend changes required)

### Fix 1: Remove JSON guard that discards handover content on refresh

**File**: `lib/hooks/useChatStream.ts`, line 282

**Problem**: When loading conversation history from the API, the `handover_result` message's `content` is discarded if it starts with `{`:

```ts
if (content && !content.startsWith('{')) {
  handoverResultContent = content;
}
```

If the backend stores the response wrapped in JSON, this silently drops it — the "View agent response" button disappears entirely after refresh.

**Fix**: Remove the guard. If content is JSON, try to extract the readable part; if it's plain text, use it directly:

```ts
if (content) {
  // If content looks like JSON, try to extract the agent's text response
  if (content.startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      handoverResultContent = parsed.response || parsed.content || parsed.message || content;
    } catch {
      handoverResultContent = content;
    }
  } else {
    handoverResultContent = content;
  }
}
```

This handles both plain text and JSON-wrapped responses without any backend change.

---

### Fix 2: Tool calls showing "Error: Unknown error" on refresh

**File**: `app/(main)/c/[conversationId]/conversation-client.tsx`, line 341-342

**Problem**: The rendering logic treats tools with **no result data** as errors:

```ts
const isSuccess = isStepComplete && message.toolResult?.success;        // undefined → falsy
const isError = isStepComplete && !message.toolResult?.success;         // !undefined → true
```

When `transformApiMessages` can't match a `tool_call` to its `tool_result` (iteration mismatch, missing result, ordering issue), `toolResult` is `undefined`. The `!undefined` evaluates to `true`, so every unmatched tool renders as an error with "Error: Unknown error".

These tools **did** complete successfully (we saw them complete in SSE) — we just don't have their result data after refresh.

**Fix**: Only flag as error when `toolResult` explicitly reports failure:

```ts
const isSuccess = isStepComplete && (message.toolResult?.success !== false);
const isError = isStepComplete && message.toolResult?.success === false;
```

This way:
- `toolResult.success === true` → green checkmark (success)
- `toolResult.success === false` → red X (real error)
- `toolResult` is `undefined` (no match) → green checkmark (assume success, data just unavailable)

---

## Summary

| # | Fix | Who | Complexity |
|---|-----|-----|-----------|
| 1 | Send full `response_preview` in SSE `handover_complete` | Backend | Low |
| 2 | Remove JSON guard on handover content | Frontend | Trivial |
| 3 | Fix error detection for unmatched tool results | Frontend | Trivial |
