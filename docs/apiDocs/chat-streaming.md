# Chat & SSE Streaming API Documentation

This document describes the Chat API and Server-Sent Events (SSE) streaming for real-time AI chat responses.

---

## Part 1: Conversations & Messages API

These endpoints manage chat conversations and retrieve message history.

### 1.1 List Conversations

**GET** `/api/conversations`

Retrieve all conversations for the authenticated user.

#### Request Headers

```
Authorization: Bearer {token}
Accept: application/json
```

#### Query Parameters

| Parameter   | Type    | Required | Description |
|-------------|---------|----------|-------------|
| per_page    | integer | No       | Items per page (1-100, default: 15) |
| status      | string  | No       | Filter by status: `active` or `archived` |
| sort_by     | string  | No       | Sort field: `created_at`, `updated_at`, `title` (default: `created_at`) |
| sort_order  | string  | No       | Sort order: `asc` or `desc` (default: `desc`) |

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Conversations retrieved successfully.",
  "data": [
    {
      "id": 57,
      "user_id": 4,
      "agent_id": 3,
      "title": "find me election cases",
      "status": "active",
      "agent": {
        "id": 3,
        "model_id": 3,
        "name": "Lawexa Orchestrator",
        "slug": "lawexa-orchestrator",
        "description": "The primary AI orchestrator for Lawexa...",
        "temperature": "0.40",
        "max_response_tokens": 4096,
        "is_active": true,
        "created_at": "2026-01-20T09:24:41+00:00",
        "updated_at": "2026-01-20T12:06:49+00:00"
      },
      "messages_count": 14,
      "created_at": "2026-01-20T19:19:21+00:00",
      "updated_at": "2026-01-20T19:19:21+00:00"
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 15,
    "total": 1
  }
}
```

### 1.2 Get Conversation with Messages

**GET** `/api/conversations/{id}`

Retrieve a single conversation with all its messages.

#### Request Headers

```
Authorization: Bearer {token}
Accept: application/json
```

#### Path Parameters

| Parameter | Type    | Required | Description |
|-----------|---------|----------|-------------|
| id        | integer | Yes      | The conversation ID |

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Conversation retrieved successfully.",
  "data": {
    "id": 57,
    "user_id": 4,
    "agent_id": 3,
    "title": "find me election cases",
    "status": "active",
    "agent": {
      "id": 3,
      "model_id": 3,
      "name": "Lawexa Orchestrator",
      "slug": "lawexa-orchestrator",
      "description": "The primary AI orchestrator for Lawexa...",
      "temperature": "0.40",
      "max_response_tokens": 4096,
      "is_active": true
    },
    "messages": [
      {
        "id": 145,
        "conversation_id": 57,
        "agent_id": null,
        "role": "user",
        "content": "find me election cases",
        "metadata": null,
        "created_at": "2026-01-20T19:19:21+00:00"
      },
      {
        "id": 146,
        "conversation_id": 57,
        "agent_id": 3,
        "role": "assistant",
        "content": "{\"tool_call\":\"search_cases\",\"parameters\":{\"query\":\"election\",\"limit\":15}}",
        "metadata": {
          "type": "tool_call",
          "tool_name": "search_cases",
          "tool_parameters": {
            "query": "election",
            "limit": 15
          },
          "iteration": 1
        },
        "created_at": "2026-01-20T19:19:44+00:00"
      },
      {
        "id": 147,
        "conversation_id": 57,
        "agent_id": 3,
        "role": "tool",
        "content": "{\"success\":true,\"message\":\"Cases retrieved successfully.\",\"data\":{\"cases\":[...],\"total\":15}}",
        "metadata": {
          "type": "tool_result",
          "tool_name": "search_cases",
          "success": true,
          "latency_ms": 1161,
          "iteration": 1
        },
        "created_at": "2026-01-20T19:19:44+00:00"
      },
      {
        "id": 148,
        "conversation_id": 57,
        "agent_id": 3,
        "role": "assistant",
        "content": "Here are the election cases I found...",
        "metadata": null,
        "created_at": "2026-01-20T19:19:44+00:00"
      }
    ],
    "messages_count": 4,
    "created_at": "2026-01-20T19:19:21+00:00",
    "updated_at": "2026-01-20T19:19:21+00:00"
  }
}
```

#### Message Roles

| Role        | Description |
|-------------|-------------|
| `user`      | Message sent by the user |
| `assistant` | Response from the AI agent |
| `tool`      | Result from a tool execution |

#### Message Metadata Types

| Type          | Description |
|---------------|-------------|
| `tool_call`   | AI is calling a tool (contains `tool_name`, `tool_parameters`, `iteration`) |
| `tool_result` | Result from tool execution (contains `tool_name`, `success`, `latency_ms`, `iteration`) |
| `null`        | Regular text message (user input or final AI response) |

### 1.3 Archive Conversation

**DELETE** `/api/conversations/{id}`

Archive a conversation (soft delete - changes status to `archived`).

#### Request Headers

```
Authorization: Bearer {token}
Accept: application/json
```

#### Path Parameters

| Parameter | Type    | Required | Description |
|-----------|---------|----------|-------------|
| id        | integer | Yes      | The conversation ID |

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Conversation archived successfully.",
  "data": null
}
```

---

## Part 2: SSE Streaming API

The SSE streaming API allows clients to receive AI responses in real-time as they are generated, rather than waiting for the complete response. This provides a better user experience for longer AI interactions.

### Flow Diagram

```
┌──────────┐          ┌──────────┐          ┌──────────┐          ┌──────────┐
│  Client  │          │  Laravel │          │  Queue   │          │  Python  │
│(Frontend)│          │   API    │          │  Worker  │          │    AI    │
└────┬─────┘          └────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │                     │
     │ POST /api/chat      │                     │                     │
     │ {stream: true}      │                     │                     │
     │────────────────────>│                     │                     │
     │                     │                     │                     │
     │ 200 OK              │                     │                     │
     │ {execution_id,      │ Dispatch Job        │                     │
     │  stream_url}        │────────────────────>│                     │
     │<────────────────────│                     │                     │
     │                     │                     │ POST /execute       │
     │                     │                     │────────────────────>│
     │ GET /api/chat/      │                     │                     │
     │ stream/{id}?token=  │                     │                     │
     │────────────────────>│                     │   Push iterations   │
     │                     │                     │   to Redis          │
     │  SSE: connected     │                     │<────────────────────│
     │<────────────────────│                     │                     │
     │                     │  BLPOP Redis        │                     │
     │  SSE: iteration     │<────────────────────│                     │
     │<────────────────────│                     │                     │
     │                     │                     │                     │
     │  SSE: tool_calling  │                     │                     │
     │<────────────────────│                     │                     │
     │                     │                     │                     │
     │  SSE: tool_complete │                     │                     │
     │<────────────────────│                     │                     │
     │                     │                     │                     │
     │  SSE: completed     │                     │                     │
     │<────────────────────│                     │                     │
     │                     │                     │                     │
     │  SSE: end           │                     │                     │
     │<────────────────────│                     │                     │
     │                     │                     │                     │
```

### SSE Endpoints

#### 2.1 Start Chat (with streaming)

**POST** `/api/chat`

Start a new chat message with streaming enabled.

#### Request Headers

```
Authorization: Bearer {token}
Content-Type: application/json
```

#### Request Body

```json
{
  "message": "Search for election cases in Nigeria",
  "stream": true,
  "conversation_id": 123,        // Optional: continue existing conversation
  "workflow_id": 1,              // Optional: use specific workflow
  "agent_id": 1                  // Optional: use specific agent
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Execution started. Connect to stream_url for real-time updates.",
  "data": {
    "conversation_id": 123,
    "workflow_id": 1,
    "execution_id": "c0ab4c63-5ce8-461b-854a-0612142672bd",
    "stream_url": "/api/chat/stream/c0ab4c63-5ce8-461b-854a-0612142672bd"
  }
}
```

#### 2.2 Connect to SSE Stream

**GET** `/api/chat/stream/{execution_id}?token={bearer_token}`

Connect to the SSE stream to receive real-time updates.

> **Note**: SSE does not support custom headers, so authentication is passed via query parameter.

#### Query Parameters

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| token     | string | Yes      | The full bearer token (e.g., `5\|WA8uwJLJFo...`) |

#### Response Headers

```
Content-Type: text/event-stream
Cache-Control: no-cache, no-store, must-revalidate
Connection: keep-alive
X-Accel-Buffering: no
```

### SSE Event Types

Each SSE event has the following format:

```
event: {event_type}
data: {json_payload}

```

### Event Types Reference

| Event Type    | Description | When Sent |
|---------------|-------------|-----------|
| `connected`   | Stream connection established | Immediately on connect |
| `iteration`   | Processing update | When AI starts processing |
| `tool_calling`| AI is calling a tool | Before tool execution |
| `tool_complete`| Tool execution finished | After tool returns result |
| `thinking`    | AI is reasoning | During complex reasoning |
| `heartbeat`   | Keep-alive signal | Every 5 seconds if no other events |
| `completed`   | AI response finished | When final response is ready |
| `error`       | An error occurred | On any error |
| `timeout`     | Stream timed out | After 120 seconds (configurable) |
| `end`         | Stream is closing | Always sent last |

### Event Payloads

#### `connected`

```json
{
  "execution_id": "c0ab4c63-5ce8-461b-854a-0612142672bd",
  "message": "Stream connected"
}
```

#### `iteration`

```json
{
  "iteration": 0,
  "status": "processing",
  "timestamp": "2026-01-21T01:15:49.894893+00:00"
}
```

#### `tool_calling`

```json
{
  "iteration": 1,
  "status": "tool_calling",
  "tool_call": {
    "name": "search_cases",
    "parameters": {
      "query": "election",
      "limit": 15
    }
  },
  "timestamp": "2026-01-21T01:16:17.650298+00:00"
}
```

#### `tool_complete`

```json
{
  "iteration": 1,
  "status": "tool_complete",
  "tool_call": {
    "name": "search_cases",
    "parameters": {
      "query": "election",
      "limit": 15
    }
  },
  "tool_result": {
    "success": true,
    "data": {
      "cases": [...],
      "total": 15
    },
    "error": null
  },
  "latency_ms": 245,
  "timestamp": "2026-01-21T01:16:17.693704+00:00"
}
```

#### `completed`

```json
{
  "iteration": 2,
  "status": "completed",
  "message": "Here are the election cases I found...",
  "tokens": {
    "prompt": 1218,
    "completion": 148
  },
  "timestamp": "2026-01-21T01:15:54.444350+00:00"
}
```

#### `heartbeat`

```json
{
  "timestamp": "2026-01-21T01:16:22+00:00"
}
```

#### `error`

```json
{
  "message": "Execution not found or access denied."
}
```

#### `end`

```
</stream>
```

### Frontend Implementation

#### JavaScript (Vanilla)

```javascript
class ChatStream {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.eventSource = null;
  }

  async sendMessage(message, options = {}) {
    // 1. Start the chat with streaming
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        stream: true,
        ...options
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    // 2. Connect to SSE stream
    return this.connectStream(data.data.execution_id);
  }

  connectStream(executionId) {
    return new Promise((resolve, reject) => {
      const encodedToken = encodeURIComponent(this.token);
      const url = `${this.baseUrl}/api/chat/stream/${executionId}?token=${encodedToken}`;

      this.eventSource = new EventSource(url);

      const result = {
        conversationId: null,
        message: '',
        toolCalls: [],
        tokens: null,
      };

      // Handle connection open
      this.eventSource.onopen = () => {
        console.log('SSE connection opened');
      };

      // Handle errors
      this.eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        this.eventSource.close();
        reject(new Error('Stream connection failed'));
      };

      // Handle events
      this.eventSource.addEventListener('connected', (e) => {
        const data = JSON.parse(e.data);
        console.log('Connected:', data);
      });

      this.eventSource.addEventListener('iteration', (e) => {
        const data = JSON.parse(e.data);
        console.log('Processing:', data);
        // Show loading indicator
      });

      this.eventSource.addEventListener('tool_calling', (e) => {
        const data = JSON.parse(e.data);
        console.log('Calling tool:', data.tool_call.name);
        // Show tool calling UI
      });

      this.eventSource.addEventListener('tool_complete', (e) => {
        const data = JSON.parse(e.data);
        console.log('Tool result:', data.tool_result);
        result.toolCalls.push(data);
        // Update tool result UI
      });

      this.eventSource.addEventListener('heartbeat', (e) => {
        // Keep-alive, no action needed
      });

      this.eventSource.addEventListener('completed', (e) => {
        const data = JSON.parse(e.data);
        result.message = data.message;
        result.tokens = data.tokens;
        console.log('Completed:', data);
      });

      this.eventSource.addEventListener('error', (e) => {
        const data = JSON.parse(e.data);
        console.error('Stream error:', data.message);
        this.eventSource.close();
        reject(new Error(data.message));
      });

      this.eventSource.addEventListener('end', (e) => {
        console.log('Stream ended');
        this.eventSource.close();
        resolve(result);
      });

      this.eventSource.addEventListener('timeout', (e) => {
        console.warn('Stream timed out');
        this.eventSource.close();
        reject(new Error('Stream timed out'));
      });
    });
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

// Usage
const chat = new ChatStream('https://demo-api.lawexa.com', 'your-bearer-token');

try {
  const result = await chat.sendMessage('Search for election cases', {
    conversation_id: 123,  // Optional
    workflow_id: 1,        // Optional
  });

  console.log('Final message:', result.message);
  console.log('Tool calls:', result.toolCalls);
  console.log('Tokens used:', result.tokens);
} catch (error) {
  console.error('Chat failed:', error.message);
}
```

#### React Hook

```tsx
import { useState, useCallback, useRef } from 'react';

interface ToolCall {
  name: string;
  parameters: Record<string, any>;
}

interface ToolResult {
  success: boolean;
  data: any;
  error: string | null;
}

interface StreamEvent {
  iteration: number;
  status: string;
  tool_call?: ToolCall;
  tool_result?: ToolResult;
  message?: string;
  tokens?: { prompt: number; completion: number };
  timestamp: string;
}

interface UseChatStreamOptions {
  baseUrl: string;
  token: string;
  onConnected?: () => void;
  onIteration?: (event: StreamEvent) => void;
  onToolCalling?: (event: StreamEvent) => void;
  onToolComplete?: (event: StreamEvent) => void;
  onCompleted?: (event: StreamEvent) => void;
  onError?: (error: string) => void;
}

export function useChatStream(options: UseChatStreamOptions) {
  const {
    baseUrl,
    token,
    onConnected,
    onIteration,
    onToolCalling,
    onToolComplete,
    onCompleted,
    onError,
  } = options;

  const [isStreaming, setIsStreaming] = useState(false);
  const [message, setMessage] = useState('');
  const [toolCalls, setToolCalls] = useState<StreamEvent[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const sendMessage = useCallback(async (
    content: string,
    chatOptions?: {
      conversation_id?: number;
      workflow_id?: number;
      agent_id?: number;
    }
  ) => {
    setIsStreaming(true);
    setMessage('');
    setToolCalls([]);

    try {
      // 1. Start chat
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          stream: true,
          ...chatOptions,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      // 2. Connect to SSE
      const encodedToken = encodeURIComponent(token);
      const url = `${baseUrl}/api/chat/stream/${data.data.execution_id}?token=${encodedToken}`;

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('connected', () => {
        onConnected?.();
      });

      eventSource.addEventListener('iteration', (e) => {
        const event = JSON.parse(e.data);
        onIteration?.(event);
      });

      eventSource.addEventListener('tool_calling', (e) => {
        const event = JSON.parse(e.data);
        onToolCalling?.(event);
      });

      eventSource.addEventListener('tool_complete', (e) => {
        const event = JSON.parse(e.data);
        setToolCalls(prev => [...prev, event]);
        onToolComplete?.(event);
      });

      eventSource.addEventListener('completed', (e) => {
        const event = JSON.parse(e.data);
        setMessage(event.message || '');
        onCompleted?.(event);
      });

      eventSource.addEventListener('error', (e) => {
        try {
          const event = JSON.parse((e as MessageEvent).data);
          onError?.(event.message);
        } catch {
          onError?.('Stream connection failed');
        }
        eventSource.close();
        setIsStreaming(false);
      });

      eventSource.addEventListener('end', () => {
        eventSource.close();
        setIsStreaming(false);
      });

      eventSource.addEventListener('timeout', () => {
        onError?.('Stream timed out');
        eventSource.close();
        setIsStreaming(false);
      });

      eventSource.onerror = () => {
        onError?.('Connection error');
        eventSource.close();
        setIsStreaming(false);
      };

      return data.data;
    } catch (error) {
      setIsStreaming(false);
      onError?.(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }, [baseUrl, token, onConnected, onIteration, onToolCalling, onToolComplete, onCompleted, onError]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  return {
    sendMessage,
    disconnect,
    isStreaming,
    message,
    toolCalls,
  };
}

// Usage in component
function ChatComponent() {
  const { sendMessage, isStreaming, message, toolCalls } = useChatStream({
    baseUrl: 'https://demo-api.lawexa.com',
    token: 'your-bearer-token',
    onConnected: () => console.log('Connected!'),
    onToolCalling: (event) => console.log('Calling:', event.tool_call?.name),
    onCompleted: (event) => console.log('Done!', event.tokens),
    onError: (error) => console.error('Error:', error),
  });

  const handleSend = async () => {
    await sendMessage('Search for election cases', {
      conversation_id: 123,
    });
  };

  return (
    <div>
      <button onClick={handleSend} disabled={isStreaming}>
        {isStreaming ? 'Processing...' : 'Send'}
      </button>

      {toolCalls.map((tc, i) => (
        <div key={i}>Tool: {tc.tool_call?.name}</div>
      ))}

      {message && <div>{message}</div>}
    </div>
  );
}
```

#### Vue 3 Composable

```typescript
import { ref, onUnmounted } from 'vue';

interface StreamEvent {
  iteration: number;
  status: string;
  tool_call?: { name: string; parameters: Record<string, any> };
  tool_result?: { success: boolean; data: any; error: string | null };
  message?: string;
  tokens?: { prompt: number; completion: number };
  timestamp: string;
}

export function useChatStream(baseUrl: string, token: string) {
  const isStreaming = ref(false);
  const message = ref('');
  const toolCalls = ref<StreamEvent[]>([]);
  const error = ref<string | null>(null);

  let eventSource: EventSource | null = null;

  const sendMessage = async (
    content: string,
    options?: {
      conversation_id?: number;
      workflow_id?: number;
      agent_id?: number;
    }
  ) => {
    isStreaming.value = true;
    message.value = '';
    toolCalls.value = [];
    error.value = null;

    try {
      // Start chat
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          stream: true,
          ...options,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      // Connect to SSE
      const encodedToken = encodeURIComponent(token);
      const url = `${baseUrl}/api/chat/stream/${data.data.execution_id}?token=${encodedToken}`;

      eventSource = new EventSource(url);

      eventSource.addEventListener('tool_complete', (e) => {
        const event = JSON.parse(e.data);
        toolCalls.value.push(event);
      });

      eventSource.addEventListener('completed', (e) => {
        const event = JSON.parse(e.data);
        message.value = event.message || '';
      });

      eventSource.addEventListener('error', (e) => {
        try {
          const event = JSON.parse((e as MessageEvent).data);
          error.value = event.message;
        } catch {
          error.value = 'Stream connection failed';
        }
        disconnect();
      });

      eventSource.addEventListener('end', () => {
        disconnect();
      });

      eventSource.onerror = () => {
        error.value = 'Connection error';
        disconnect();
      };

      return data.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      isStreaming.value = false;
      throw err;
    }
  };

  const disconnect = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    isStreaming.value = false;
  };

  onUnmounted(() => {
    disconnect();
  });

  return {
    sendMessage,
    disconnect,
    isStreaming,
    message,
    toolCalls,
    error,
  };
}
```

### Error Handling

#### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Missing authentication token` | No token in query params | Include `?token=` parameter |
| `Invalid authentication token` | Token is invalid or expired | Refresh token and retry |
| `Execution not found or access denied` | Invalid execution_id or not owner | Verify execution_id and user owns it |
| `Stream timed out` | No completion within 120s | Retry or check AI service |

#### Retry Strategy

```javascript
async function sendWithRetry(chat, message, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await chat.sendMessage(message, options);
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Wait before retry (exponential backoff)
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
}
```

### Best Practices

1. **Always handle the `end` event** - Close the EventSource when receiving this event to free resources.

2. **Implement reconnection logic** - If connection drops, reconnect with the same execution_id (within timeout window).

3. **Show progress to users** - Use `iteration`, `tool_calling`, and `tool_complete` events to show what the AI is doing.

4. **Handle timeouts gracefully** - The stream times out after 120 seconds. Show appropriate UI feedback.

5. **URL encode the token** - The token contains `|` character which must be URL encoded.

6. **Clean up on unmount** - Always close EventSource when component unmounts to prevent memory leaks.

### Configuration

| Config Key | Default | Description |
|------------|---------|-------------|
| `services.ai.sse_timeout` | 120 | Maximum stream duration in seconds |
| `services.ai.redis_prefix` | `ai:` | Redis key prefix for iterations |
