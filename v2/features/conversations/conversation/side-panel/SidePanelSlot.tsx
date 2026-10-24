'use client';

import type { EngineMessage, StreamingSource } from '@/v2/runtime/chat-engine/types';
import { DraftPanel } from '../draft/DraftPanel';
import { FilePanel } from '../files/FilePanel';
import { useSidePanel } from './SidePanelContext';

/**
 * SidePanelSlot — what the chat's side panel holds for the open `?side=`
 * value: a draft, or a file the file list in chat opened (piece a). A note
 * arrives with a later piece. Nothing is drawn while the param is closed or
 * names a kind this build does not show yet.
 */
export function SidePanelSlot({
  messages,
  streamingText,
}: {
  messages: readonly EngineMessage[];
  streamingText: StreamingSource;
}) {
  const panel = useSidePanel();
  const target = panel?.target;
  if (!target) return null;
  switch (target.kind) {
    case 'draft':
      return <DraftPanel key={target.ordinal} ordinal={target.ordinal} messages={messages} streamingText={streamingText} />;
    case 'file':
      return <FilePanel key={target.id} fileId={target.id} />;
    default:
      return null;
  }
}
