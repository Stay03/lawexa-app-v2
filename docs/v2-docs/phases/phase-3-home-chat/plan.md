# Phase 3 — Home + Chat: plan

**Objective:** the core product surface rebuilt on the approved design language. Exit = testers
do their daily research in v2.

> Expand to task level at kickoff. Key specs: `foundation-standards.md` §5 (streaming chat
> rendering spec) and §2 (chat streaming vs cache).

## Scope (build order)

1. **Chat engine port** (`v2/runtime/chat-engine/`): lift `useChatStream`'s SSE core — keep the
   resilience (60s watchdog, 3× reconnect, polling fallback, seq dedup, event taxonomy,
   confidential IndexedDB integration) — and add the streaming-rendering policy: token buffer in
   a ref, 50–80ms flushes in `startTransition`.
2. **Home** (`/`): greeting, composer (exact shimmer, jurisdiction/workflow chips, uploads),
   suggested prompts, guest handling. Replaces the stub in the manifest.
3. **Conversation view** (`/c/[conversationId]`): virtualized message list
   (`@tanstack/react-virtual`, `anchorTo: 'end'`, `followOnAppend`), memoized rows, streaming
   markdown (Streamdown), tool-call/reasoning progressive disclosure, scroll etiquette
   (pin-only-at-bottom, jump pill with count), stop/regenerate, inline error + retry,
   **working message actions** (copy/feedback — dead buttons in v1), **floating composer**
   (owner feedback) on the keyboard-safe shell.
4. **Cache integration**: send/create/complete updates the conversations list cache
   (`queryOptions` factory for conversations; RSC prefetch + hydration for the sidebar/list).
5. **Conversations list page** + sidebar recents on the same query source.
6. **Mobile verification on real devices** (iOS Safari + Android Chrome): keyboard, safe-area,
   touch actions (long-press sheet), 44px targets.
7. Metadata: conversation `generateMetadata`/OG kept and moved into the v2 convention.

## Manifest additions

`/` → then `/c/[id]` + `/conversations` as each becomes real.

## Exit criteria

Testers default to v2 for chat; chat↔sidebar staleness bug class gone; on-device keyboard
correctness confirmed; `post-implementation.md` written.
