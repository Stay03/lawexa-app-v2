# What happens to an answer after it reaches the browser

**The browser half of "our current way", 21 August 2026.**

@backendclaude's document ends at the moment an event arrives at the browser.
This one starts there. Same phases, same names, so the two can be laid side by
side row for row.

Everything here is read from the files, not remembered. Line references are to
`v2/runtime/chat-engine/engine.ts` unless another file is named. The v1 app runs
the same protocol through `lib/hooks/useChatStream.ts`; where the two differ it
is said.

---

## 0 · What owns this

One file. `engine.ts` is a plain state machine with **no React imports** — it
owns the connection, the whole resilience surface, and the writing of text to
the screen. React sees it through `use-conversation-stream.ts`.

That matters for the websocket move: the part that would change is small and in
one place, and the part that interprets events does not know what carried them.

---

## 1 · CONNECT

The browser opens an `EventSource` to the streaming endpoint (`engine.ts:1062`).
Sixteen named listeners are attached: `connected`, `iteration`,
`handover_started`, `handover_complete`, `tool_calling`, `tool_complete`,
`text_delta`, `text_done`, `text_reset`, `heartbeat`, `thinking`, `completed`,
`error`, `cancelled`, `end`, `timeout`.

A watchdog starts with the connection (`engine.ts:689`).

**What can go wrong, and what we do.** A malformed event body does not throw —
it parses to `null` and is ignored (`engine.ts:147`). This exists because a
single bad frame used to kill the whole turn in v1.

---

## 2 · START

The browser sends the question, gets an execution id back, then connects.

**The case worth knowing: the answer is already running.** If the send is
refused with a 409 carrying `PENDING_RESPONSE`, the browser does not show an
error — it reads the execution id out of the refusal and attaches to the answer
already in flight (`engine.ts:2005-2011`). That is what stops a double-tap, a
reload mid-answer, or a second tab from starting a second answer.

---

## 3 · STREAM

Text arrives as `text_delta` events carrying only the new words. The browser
appends them (`engine.ts:1155`).

**Tokens do not re-render the transcript.** They accumulate outside React and
are flushed on a 50–80 ms cadence into per-message stores
(`DEFAULT_FLUSH_INTERVAL_MS = 60`, `engine.ts:132`; `stream-smoother.ts`). Without
this, every token repaints the conversation.

**The pace is smoothed on purpose.** The smoother spreads arrival so the text
reads at an even speed rather than in bursts. This is why polling every two
seconds would be visibly worse: the same words, delivered in lumps.

Tool rows, sub-agent handovers and "thinking" are separate events that draw
their own rows as they arrive.

**Sequence numbers.** Structural events carry `seq`, and the engine keeps a set
of the ones it has already seen, seeded from saved history (`engine.ts:780-787`),
so a replayed event is dropped rather than shown twice.

**`text_delta` is deliberately excluded from that set** — the code says so at
`engine.ts:1151`: the deltas are throwaway and `seq` is one shared counter.
`types/chat.ts:212` marks another as "ordering hint only — never use for dedup".
**This is the gap the websocket move has to close**, and it is the only one.

---

## 4 · FINISH

`text_done` stops the cursor. `completed` then arrives carrying the **entire
finished answer**, and the browser treats it as the truth, replacing what it
accumulated (`engine.ts:1314`, `const finalText = event.content ?? event.message ?? ''`).

**This is the event that cannot cross a websocket.** Reverb refuses frames over
10,000 bytes; one real answer measured 15,760 characters. The failure would be
silent and the answer would look complete while being wrong.
@backendclaude's answer — send the ids and counts but not the text, and let the
browser fetch the authoritative copy — is the right shape, and phase 8 below is
why it costs us nothing.

**One case already handled.** When the server reports `replayable: false`
(confidential chats, a late connect, a database replay), the browser does not
paint a blank bubble — it falls back to the local transcript
(`engine.ts:1316-1330`, `confidential-transcript.ts`).

---

## 5 · INTERRUPT AND RECOVER

Three layers, in order.

**The browser's own retry.** On a connection error the browser reconnects by
itself and sends `Last-Event-ID`, and the server replays what was missed. We
wrote no code for this — it is built into the transport, and the engine
deliberately stays out of the way until the connection is permanently closed
(`engine.ts:1592-1600`). **Over a websocket this stops being free**, which is
the single genuinely new piece of work.

**Our retry.** Up to 3 reconnects, 1 second apart (`SSE_MAX_RECONNECTS`,
`SSE_RECONNECT_DELAY_MS`, `engine.ts:122-123`; `reconnectStream` at
`engine.ts:1684`).

**Polling.** After those are exhausted, ask for the conversation's status every
5 seconds, giving up after 10 minutes so a stuck answer cannot poll forever
(`POLL_INTERVAL_MS`, `POLL_MAX_DURATION_MS`, `engine.ts:116-117`). When the
status stops being `pending`, the finished conversation is fetched and painted.

**The watchdog above all three.** If 60 seconds pass with no event of any kind,
the stream is presumed dead and the ladder above starts
(`WATCHDOG_SILENCE_MS = 60_000`, checked every 10 s, `engine.ts:111-112, 689`).

**A phone that slept, or a page reloaded.** `recoverPendingState`
(`engine.ts:2028`) asks the server what the conversation is doing. Still
running, and it attaches to the live execution or starts polling. Already
finished, and it loads the result. This path **does not depend on the transport
at all** and survives the websocket move untouched.

---

## 6 · CANCEL

Pressing stop sends a cancel and **does not close the connection**
(`engine.ts:1747`). A 200 means "cancel accepted", not "stream stopped" — the
terminal event from the server is what finalises the row.

Two details that exist because they were wrong once:

- **Stop feels instant.** If a text drain is still animating when Stop is
  pressed, it is landed immediately rather than played out (`abandonDrains`).
- **A guard that is immune to React batching** stops a double press sending two
  cancels (`isCancelling` held as a plain variable, not state).

---

## 7 · MULTI-DEVICE / A SECOND TAB

Heartbeats prove the connection is alive but carry no data. After 12 consecutive
heartbeats with no data — about 60 seconds — the browser checks the
conversation's status (`HEARTBEAT_ONLY_THRESHOLD`, `engine.ts:129`;
`checkStaleStream`, `engine.ts:705`).

**This exists for exactly the case @backendclaude raised:** another tab already
consumed the terminal events, so this one would otherwise wait forever on a
healthy-looking connection. It finishes from the saved copy instead.

---

## 8 · WHEN THE ANSWER ITSELF FAILS

An `error` event finalises the open row from the accumulated text rather than
abandoning it, and marks it `partial: { reason: 'error' }`
(`finalizeOpenPlaceholder`, `engine.ts:1613`). The reader keeps the words that
did arrive, and the row says it was cut short.

The same shape covers `cancelled` and `timeout`.

**A new answer starting without closing the old one** used to leave the previous
row permanently empty; it is now written out before being retired
(`retireStreamingPlaceholder`, `engine.ts:1639`).

---

## 9 · LIMITS

| Thing | Value | Where |
|---|---|---|
| Silence before the stream is presumed dead | 60 s | `engine.ts:111` |
| Watchdog check interval | 10 s | `engine.ts:112` |
| Reconnect attempts | 3, 1 s apart | `engine.ts:122-123` |
| Poll interval after reconnects fail | 5 s | `engine.ts:116` |
| Longest we will poll | 10 min | `engine.ts:117` |
| Heartbeats with no data before a status check | 12 (≈60 s) | `engine.ts:129` |
| Token flush cadence | 60 ms | `engine.ts:132` |

---

## 10 · WHAT IS RECORDED AFTERWARDS

The `completed` event carries `persisted_message_ids` — the answer is in the
database **before** that event is sent. So the saved copy is always the
authority and the stream is only the fast path.

For confidential conversations the transcript is kept in the browser's own
storage instead (`confidential-transcript.ts`), which is why the
`replayable: false` fallback in phase 4 exists.

---

## What this means for the move, in one paragraph

Phases 3, 4, 6, 7, 8 and 10 do not care what carried the event and survive
unchanged. Phase 1 is a few lines. Phase 5 is the real work, and only one part
of it: the browser's free resume disappears and we have to number the running
text ourselves. Phase 4 needs a decision about the final event, which
@backendclaude has already proposed the right answer to.

Everything else already exists and is already tested by real use.
