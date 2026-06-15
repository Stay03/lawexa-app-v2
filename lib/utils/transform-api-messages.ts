import type {
  ApiMessage,
  ConversationMessage,
  ChatMessage,
  ToolMessage,
  HandoverMessage,
  ErrorMessage,
} from '@/types/chat';

/**
 * Transform the server's persisted message shape (`ApiMessage[]`) into the
 * local render model (`ConversationMessage[]`): matches tool calls with their
 * results, collapses handover request/result pairs, recovers inter-tool
 * narration via lookahead, and normalizes attachments.
 *
 * Pure function — single source of truth shared by `useChatStream` (full
 * conversation page) and the floating chat panel. Keep it dependency-free so
 * both callers behave identically when rendering a saved thread.
 */
export function transformApiMessages(apiMessages: ApiMessage[]): ConversationMessage[] {
  const messages: ConversationMessage[] = [];

  // Option A heuristic: classify untagged assistant text messages as narration
  // if they are followed by tool/handover work in the same turn (before the
  // next user message). The backend currently saves inter-tool narration with
  // metadata:null, indistinguishable from a final answer; this lookahead
  // recovers the distinction. (Track for backend: tag these with
  // metadata.type:"narration" and this pre-pass becomes unnecessary.)
  const narrationApiIds = new Set<number>();
  for (let i = 0; i < apiMessages.length; i++) {
    const m = apiMessages[i];
    if (m.role !== 'assistant' || m.metadata?.type || m.metadata?.partial) continue;
    for (let j = i + 1; j < apiMessages.length; j++) {
      const next = apiMessages[j];
      if (next.role === 'user') break;
      const t = next.metadata?.type;
      if (next.role === 'tool' || t === 'tool_call' || t === 'handover') {
        narrationApiIds.add(m.id);
        break;
      }
    }
  }

  // Build lists of tool results by iteration for matching (lists handle iteration resets across executions)
  const toolResultsByIteration = new Map<number, ApiMessage[]>();
  apiMessages.forEach(msg => {
    if (msg.role === 'tool' && msg.metadata?.type === 'tool_result' && msg.metadata.iteration !== undefined) {
      const list = toolResultsByIteration.get(msg.metadata.iteration) || [];
      list.push(msg);
      toolResultsByIteration.set(msg.metadata.iteration, list);
    }
  });

  // Build lists of handover results by iteration for matching
  const handoverResultsByIteration = new Map<number, ApiMessage[]>();
  apiMessages.forEach(msg => {
    if (msg.role === 'assistant' && msg.metadata?.type === 'handover_result' && msg.metadata.iteration !== undefined) {
      const list = handoverResultsByIteration.get(msg.metadata.iteration) || [];
      list.push(msg);
      handoverResultsByIteration.set(msg.metadata.iteration, list);
    }
  });

  for (const apiMsg of apiMessages) {
    // User message
    if (apiMsg.role === 'user') {
      // Normalize the two server shapes: prefer `attachments` (array,
      // new), fall back to `attachment` (singular, legacy). Always set
      // both on the local message so old and new renderers both work.
      const list = apiMsg.attachments && apiMsg.attachments.length > 0
        ? apiMsg.attachments
        : apiMsg.attachment
          ? [apiMsg.attachment]
          : undefined;
      messages.push({
        id: `msg_${apiMsg.id}`,
        role: 'user',
        content: apiMsg.content,
        timestamp: new Date(apiMsg.created_at),
        ...(list && {
          attachments: list,
          attachment: list[0],
        }),
      } as ChatMessage);
    }
    // Handover message - orchestrator delegating to sub-agent
    else if (apiMsg.role === 'assistant' && apiMsg.metadata?.type === 'handover') {
      const iteration = apiMsg.metadata.iteration;
      const handoverResult = iteration !== undefined
        ? handoverResultsByIteration.get(iteration)?.shift()
        : undefined;

      // Extract handover result content if available
      let handoverResultContent: string | undefined;
      if (handoverResult) {
        const content = handoverResult.content;
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
      }

      messages.push({
        id: `msg_${apiMsg.id}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(apiMsg.created_at),
        messageType: 'handover',
        agentSlug: apiMsg.metadata.target_agent || 'agent',
        task: apiMsg.metadata.task || '',
        handoverStatus: 'complete',
        handoverType: handoverResult?.metadata?.handover_type || apiMsg.metadata.handover_type || 'consult',
        latencyMs: handoverResult?.metadata?.latency_ms,
        success: handoverResult?.metadata?.success ?? true,
        handoverResultContent,
      } as HandoverMessage);
    }
    // Skip handover result messages (already captured above)
    else if (apiMsg.role === 'assistant' && apiMsg.metadata?.type === 'handover_result') {
      continue;
    }
    // Skip narration messages — shown transiently during streaming via onNarration callback
    else if (apiMsg.role === 'assistant' && apiMsg.metadata?.type === 'narration') {
      continue;
    }
    // Assistant tool call - transform to ToolMessage with result
    else if (apiMsg.role === 'assistant' && apiMsg.metadata?.type === 'tool_call') {
      const toolResult = apiMsg.metadata.iteration !== undefined
        ? toolResultsByIteration.get(apiMsg.metadata.iteration)?.shift()
        : undefined;

      // Parse tool result if available
      let parsedToolResult = undefined;
      if (toolResult) {
        try {
          const resultData = JSON.parse(toolResult.content);
          parsedToolResult = {
            success: toolResult.metadata?.success ?? resultData.success ?? true,
            data: resultData.data ?? resultData,
            error: null,
          };
        } catch {
          parsedToolResult = {
            success: toolResult.metadata?.success ?? true,
            data: toolResult.content,
            error: null,
          };
        }
      }

      messages.push({
        id: `msg_${apiMsg.id}`,
        role: 'tool',
        content: `${apiMsg.metadata.tool_name} completed`,
        timestamp: new Date(apiMsg.created_at),
        toolName: apiMsg.metadata.tool_name || 'unknown',
        toolParameters: apiMsg.metadata.tool_parameters || {},
        toolResult: parsedToolResult,
        toolStatus: 'complete',
        latencyMs: toolResult?.metadata?.latency_ms,
      } as ToolMessage);
    }
    // Skip tool role messages (already captured via tool_call)
    else if (apiMsg.role === 'tool') {
      continue;
    }
    // Partial assistant message — the stream was cancelled or errored
    // mid-response and the backend rescued whatever text had been generated.
    // Render as a normal ChatMessage (with markdown etc.) but tagged so the
    // UI can show a "Stopped" / "Interrupted" badge beneath the content.
    // IMPORTANT: this branch MUST come before the `type === 'error'` branch
    // below, so partial precedence wins if both flags ever co-occur.
    else if (apiMsg.role === 'assistant' && apiMsg.metadata?.partial === true) {
      messages.push({
        id: `msg_${apiMsg.id}`,
        role: 'assistant',
        content: apiMsg.content,
        timestamp: new Date(apiMsg.created_at),
        partial: {
          reason: apiMsg.metadata.reason ?? 'cancelled',
        },
      } as ChatMessage);
    }
    // Error message saved by backend
    else if (apiMsg.role === 'assistant' && apiMsg.metadata?.type === 'error') {
      messages.push({
        id: `msg_${apiMsg.id}`,
        role: 'assistant',
        content: apiMsg.content,
        timestamp: new Date(apiMsg.created_at),
        messageType: 'error',
        errorCode: apiMsg.metadata.error_code || 'UNKNOWN',
        retryable: apiMsg.metadata.retryable ?? false,
        retryAfterMs: apiMsg.metadata.retry_after_ms ?? null,
      } as ErrorMessage);
    }
    // Inter-tool narration identified by lookahead — drop, matches behavior
    // for backend-tagged narration above.
    else if (apiMsg.role === 'assistant' && !apiMsg.metadata?.type && narrationApiIds.has(apiMsg.id)) {
      continue;
    }
    // Regular assistant message (final response)
    else if (apiMsg.role === 'assistant' && !apiMsg.metadata?.type) {
      messages.push({
        id: `msg_${apiMsg.id}`,
        role: 'assistant',
        content: apiMsg.content,
        timestamp: new Date(apiMsg.created_at),
      } as ChatMessage);
    }
  }

  return messages;
}
