# SSE Streaming Bugs — Backend Report

## Summary

We ran systematic tests using `curl` against the production SSE streaming endpoint to understand what happens when a client disconnects and reconnects (simulating page refresh or opening a conversation in a second tab). We found **5 distinct bugs** in the SSE controller's late-connection and Redis consumption logic that break the frontend experience.

---

## Test Methodology

1. `POST /api/chat` to start a streaming execution → get `execution_id`
2. **Tab 1**: `GET /api/chat/stream/{executionId}?token=...` — consume events for 5–10 seconds, then disconnect (simulating page refresh)
3. **Status check**: `GET /api/conversations/{id}/status` — verify execution is still `pending`
4. **Tab 2**: `GET /api/chat/stream/{executionId}?token=...` — reconnect to same execution ID
5. **Tab 2B**: `GET /api/chat/stream/{newExecutionId}?token=...` — connect to the new execution ID returned by `/status`

Tests were run across workflows 5 and 12 with both short (simple model response) and long (multi-agent with sub-agents) executions.

---

## Bug 1: Lost Events Between Connections (Redis BLPOP)

### What happens
When Tab 1 disconnects and Tab 2 connects to the same `execution_id`, events consumed by Tab 1 are permanently lost. Tab 2 starts from wherever the Redis queue currently is.

### Evidence
| Test | Tab 1 seq range | Tab 2 first seq | Lost events |
|------|----------------|----------------|-------------|
| Workflow 5 | 1–19 | 27 | seq 20–26 |
| Workflow 12 (land) | 1–39 | 46 | seq 40–45 |
| Workflow 12 (kidnap) | 1–43 | (continued from queue) | gap present |

### Root cause
The SSE controller uses `BLPOP` on a Redis List, which is a **consuming read**. Once an event is popped, it's gone. A second consumer cannot replay it.

### Impact on frontend
- Missing `handover_started` events → handover cards never created, subsequent tool calls appear orphaned
- Missing `tool_calling` events → `tool_complete` arrives for a tool the UI never saw start
- Missing `text_delta` events → gap in streamed text (though `completed` eventually replaces it)

### Suggested fix
Switch from Redis Lists (`LPUSH`/`BLPOP`) to **Redis Streams** (`XADD`/`XREAD`). Redis Streams allow multiple consumers to read the same events, and support reading from a specific ID (enabling `Last-Event-ID` replay). The SSE events already include `id:` fields that look like Redis Stream IDs (e.g., `1776099692799-0`), so this may already be partially in place.

---

## Bug 2: No Terminal Event on Reconnection

### What happens
When Tab 2 connects to the original `execution_id` and the stream is still active, it receives live events (text_deltas, tool_calls, handovers) but **never receives `completed` or `end`**. The stream just stops producing events.

### Evidence
| Test | Tab 2 events received | Got `completed`? | Got `end`? |
|------|----------------------|-----------------|-----------|
| Workflow 12 (land) | 561 events over 2 min | No | No |
| Workflow 12 (kidnap) | 885 events over 10s | No | No |

Tab 2 received hundreds of live events including `handover_started`, `handover_complete`, `text_delta`, `tool_calling` — proving the stream was active and delivering data. But the terminal event never arrived.

### Impact on frontend
- Frontend stays in `isStreaming: true` forever
- User sees a frozen blinking cursor
- Eventually the 60-second watchdog fires and does a status check, which triggers a full history reload — but this is a bad UX (60 seconds of apparent hang)

### Suggested fix
The `completed` event must be delivered to **all active SSE connections** for that execution, not just the first one. If using Redis Streams, this happens automatically. If using Lists, the terminal event needs to be broadcast separately (e.g., via Redis Pub/Sub).

---

## Bug 3: Execution ID Rotation

### What happens
While an execution is still running (`status: pending`), the `/status` endpoint returns a **different `execution_id`** than the one returned by `POST /api/chat`. In one test, we observed **3 different execution IDs** within minutes for the same conversation turn.

### Evidence
```
POST /api/chat           → execution_id: 556dc07a
GET /status (10s later)  → execution_id: 124c548e  (CHANGED)
GET /status (30s later)  → execution_id: 93863dee  (CHANGED AGAIN)
```
All while the conversation was still `pending` and the Python AI was still working.

### Impact on frontend
- `recoverPendingState()` gets the new execution ID from `/status`
- Connects to the new execution ID → gets false `completed` (Bug 4)
- The original execution's stream (which has the real live events) is abandoned
- If frontend stored the original execution ID for cancel, `POST /cancel` goes to the wrong execution

### Suggested fix
The execution ID for a conversation turn should be stable. If the backend needs to create internal retry/continuation executions, those should not be exposed via `/status`. The `/status` endpoint should always return the execution ID that has the active SSE stream.

---

## Bug 4: False `completed` Event on Late Connection

### What happens
When connecting to an execution ID whose Redis queue is empty (either because events were consumed by another connection, or because the execution ID was rotated), the backend immediately sends:
```
event: connected
event: completed   ← with stale DB content
event: end
```
This happens even when the conversation is still `pending`.

### Evidence
Every test of connecting to a rotated execution ID produced the same result:
```
=== Connected at 18:23:32 ===
event: connected
event: completed    ← instant, 1 second
event: end
=== Done at 18:23:33 ===
```

### Impact on frontend
- Frontend receives `completed` → sets `isStreaming: false`, renders content as final answer
- User sees a "finished" response that is actually stale/wrong
- User cannot tell the AI is still working on their question

### Suggested fix
Before sending `completed` from the DB fallback path, **check the conversation status**. If the conversation is still `pending`, do NOT send `completed`. Instead:
- Option A: Send `connected` + heartbeats and wait for live events from Redis
- Option B: Send an error/redirect event telling the client to poll `/status`
- Option C: Don't send anything and let the client's watchdog handle recovery

---

## Bug 5: Wrong Content in False `completed`

### What happens
When the DB fallback sends `completed`, it grabs the latest assistant message from the database. But this is often a **sub-agent's response** (narration, handover_result, or even a sub-agent refusal) rather than the final orchestrator response.

### Evidence

**Test 2 (workflow 12, land ownership)**:
- False `completed.content` was: `"RESEARCH SUMMARY\nTopic: Legal framework for land ownership..."` — this was the **statute researcher sub-agent's output**, not the orchestrator's final answer.

**Test 4 (workflow 12, kidnapping case)**:
- False `completed.content` was the **issue-spotter sub-agent's refusal**: `"I cannot provide a comprehensive legal analysis, explain the elements of crimes..."` — a sub-agent that refused to analyze was rendered as the final answer to the user.

### Impact on frontend
- Sub-agent intermediate output rendered as a top-level assistant message (outside any handover card)
- Sub-agent refusals/errors shown as the final answer
- User sees confusing, incomplete, or wrong content

### Suggested fix
If the DB fallback path must exist, it should only send content from messages where `metadata IS NULL` (the final assistant response) or `metadata.type = 'final'`. Never send `narration`, `handover_result`, or `tool_result` messages as `completed.content`.

---

## Reproduction Script

```bash
TOKEN="url-encoded-token-here"

# 1. Start execution
RESPONSE=$(curl -s -X POST "https://prod-api.lawexa.com/api/chat" \
  -H "Authorization: Bearer {raw-token}" \
  -H "Content-Type: application/json" \
  -d '{"message":"Explain land ownership law in Nigeria","stream":true,"stream_mode":"v2_stream","workflow_id":12}')

EXEC_ID=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['execution_id'])")
CONV_ID=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['conversation_id'])")

# 2. Tab 1: consume 5 seconds
timeout 5 curl -s -N "https://prod-api.lawexa.com/api/chat/stream/${EXEC_ID}?token=${TOKEN}" > tab1.txt

# 3. Check status
curl -s "https://prod-api.lawexa.com/api/conversations/${CONV_ID}/status" \
  -H "Authorization: Bearer {raw-token}" | python3 -m json.tool

# 4. Tab 2: reconnect to same execution ID
timeout 30 curl -s -N "https://prod-api.lawexa.com/api/chat/stream/${EXEC_ID}?token=${TOKEN}" > tab2.txt

# 5. Compare
echo "Tab 1 events: $(grep -c '^event:' tab1.txt)"
echo "Tab 2 events: $(grep -c '^event:' tab2.txt)"
echo "Tab 1 seq range: $(grep -o '"seq":[0-9]*' tab1.txt | head -1) ... $(grep -o '"seq":[0-9]*' tab1.txt | tail -1)"
echo "Tab 2 seq range: $(grep -o '"seq":[0-9]*' tab2.txt | head -1) ... $(grep -o '"seq":[0-9]*' tab2.txt | tail -1)"
grep -c 'event: completed' tab2.txt  # Should be 1 but is often 0
```

---

## Summary

| # | Bug | Severity | Where |
|---|-----|----------|-------|
| 1 | Lost events (BLPOP consuming read) | High | SSE Controller — Redis consumer |
| 2 | No terminal event on reconnection | High | SSE Controller — event delivery |
| 3 | Execution ID rotation mid-stream | High | Status endpoint / execution lifecycle |
| 4 | False `completed` when status is `pending` | Critical | SSE Controller — DB fallback path |
| 5 | Wrong content in false `completed` | Critical | SSE Controller — DB fallback query |

### Recommended Architecture Change

Switch from **Redis Lists** (`LPUSH`/`BLPOP`) to **Redis Streams** (`XADD`/`XREAD`):

1. **Multiple consumers**: Any number of SSE connections can read the same events
2. **Replay from ID**: `XREAD` with a stream ID enables `Last-Event-ID` replay (the SSE `id:` fields already contain Redis Stream IDs like `1776099692799-0`)
3. **No data loss**: Events persist in the stream until explicitly trimmed
4. **Terminal event delivery**: `completed`/`end` events are in the stream and readable by all consumers
5. **The EventSource `Last-Event-ID` header** would work automatically — the browser sends it on reconnect, the backend reads from that stream position

### Interim Mitigation (No Architecture Change)

If Redis Streams migration is not immediate:

1. **Don't send `completed` from DB fallback when status is `pending`** — send heartbeats instead and let the client poll `/status`
2. **Don't rotate `execution_id`** in `/status` while the original execution is still running
3. **If DB fallback must send `completed`**, only use messages where `metadata IS NULL` (final response), never narration/handover_result
