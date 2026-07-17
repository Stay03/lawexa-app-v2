# Backend Fix Required: Narration vs Response Typing + Missing Text on Refresh

## Issue 1: Answer Content Saved as `narration`

### Problem

In the multi-question workflow, the orchestrator's actual answer to each question is saved to DB as `metadata.type: 'narration'` instead of as a normal assistant response (`metadata: null`). Only the **last** question's answer gets saved as a proper response via the `completed` event. All previous questions' answers are persisted as narrations.

### Evidence

**Conversation `f8925aa0`** (4 questions about professional ethics):

| Message ID | `agent_slug` | Length | Content | Should be |
|-----------|-------------|--------|---------|-----------|
| #116362 | `null` (orchestrator) | 449 | Progress card + "Let me begin with Question 1..." | `narration` ✓ |
| #116364 | `issue-spotter` | 358 | "I have reviewed the scenario... per the MANDATORY FIRST STEP..." | `narration` ✓ |
| #116367 | `issue-spotter` | 296 | "Step 2: Calling view_notes on the most relevant result..." | `narration` ✓ |
| #116371 | `null` (orchestrator) | 111 | "Now let me consult the Statute Researcher..." | `narration` ✓ |
| **#116442** | **`null` (orchestrator)** | **5,697** | **Full Q1 answer: "QUESTION 1: Would it have been improper..."** | **`null` (response)** |
| #116465 | `null` (orchestrator) | 68 | "Now let me search for additional context..." | `narration` ✓ |
| **#116486** | **`null` (orchestrator)** | **4,285** | **Full Q2 answer: "QUESTION 2: Are there exceptions..."** | **`null` (response)** |
| #116497 | `null` (orchestrator) | 81 | "Now let me get the specific statutory provisions..." | `narration` ✓ |

Messages #116442 and #116486 are **complete legal analyses** with headings, citations, and conclusions — not narration commentary. They should be saved as `metadata: null` so they render as normal assistant responses on page load.

**Conversation `33ca488e`** (same issue):

| Message ID | Length | Content | Should be |
|-----------|--------|---------|-----------|
| **#116795** | **8,655** | **Full Q1 answer with `<multi_question_progress>` + legal analysis** | **`null` (response)** |


### Impact if not fixed

The frontend will hide narrations from the conversation view. Short commentary narrations should be hidden — but actual answer content will also be hidden, meaning users lose Q1-Q(N-1) answers on page refresh. Only the last question's answer (from `completed` event) survives.

---

## Issue 2: Missing Response Text on Page Refresh Mid-Stream

### Problem

When a user refreshes the page while the orchestrator is actively streaming response text (via `text_delta` events), the in-progress text is lost. On refresh:

1. Frontend loads conversation history from `GET /api/conversations/{id}`
2. Tool calls, handovers, and narrations that were already saved to DB are present ✓
3. The text currently being streamed via `text_delta` is **not in the DB** — it hasn't hit a `text_reset` or `completed` event yet
4. Frontend reconnects to SSE and picks up new `text_delta` events from the current position
5. User sees: previous tool calls → gap → text continuing mid-sentence

### What the user sees

Before refresh: "...THE FACTS\n\nMrs. Amina Zubair, Managing Director of Northern Crest Microfinance Bank Ltd, invited Mr. Tunde Adeyemi Esq, a legal practitioner, to her office..."

After refresh: "...or Federal High Court has jurisdiction over kidnapping and murder\n2. Whether military officers can be tried..."

The beginning of the response is gone because it was only in the `text_delta` stream buffer, never saved to DB.

### Suggested fix

When a client reconnects to an active stream (via the SSE endpoint), the backend should include the **accumulated text buffer** for the current iteration in the connection response. This could be:

**Option A**: Include `accumulated_text` in the `connected` event payload when reconnecting:
```json
{
  "event": "connected",
  "data": {
    "execution_id": "...",
    "message": "Stream connected",
    "accumulated_text": "...all text_delta content so far for current iteration..."
  }
}
```

**Option B**: Emit a synthetic `text_delta` with the full accumulated text before continuing the live stream.

**Option C**: Periodically save the text buffer to DB (e.g., every 30 seconds or every 1000 chars) as a `partial` or `draft` message that gets replaced by the final response.

Option A is cleanest — the frontend can seed the streaming placeholder with the accumulated text on reconnect, then continue appending new deltas.

---

## Summary

| Issue | What | Fix needed |
|-------|------|-----------|
| **Narration typing** | Orchestrator answer text (5-8K chars) saved as `narration` instead of response | Save substantial orchestrator text as `metadata: null` |
| **Missing text on refresh** | In-progress `text_delta` content not available on reconnect | Include accumulated text buffer on reconnect |

Both issues affect the user experience on page refresh. The narration typing fix is higher priority — it causes permanent data misclassification. The missing text issue is lower priority — it only affects the brief moment of refresh mid-stream.
