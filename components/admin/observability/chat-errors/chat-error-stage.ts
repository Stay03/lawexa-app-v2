import { makeStatusMeta } from '@/lib/utils/observability';
import type { ChatErrorStage } from '@/types/admin-chat-errors';

/* Red for a turn the user lost (the send, the provider, the stream, the job),
   amber for a turn the system stopped on purpose or a tool that did not
   answer, blue for what the app itself reported. */
export const chatErrorStageMeta = makeStatusMeta<ChatErrorStage>({
  refused: { label: 'Refused', tone: 'warning' },
  validation: { label: 'Validation', tone: 'warning' },
  send_failed: { label: 'Send failed', tone: 'danger' },
  provider: { label: 'Provider', tone: 'danger' },
  tool: { label: 'Tool', tone: 'warning' },
  stream: { label: 'Stream', tone: 'danger' },
  job: { label: 'Job', tone: 'danger' },
  client: { label: 'Client', tone: 'info' },
});
