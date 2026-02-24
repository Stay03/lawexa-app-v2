import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import path from 'path';
import { fetchConversationForMetadata } from '@/lib/api/server';

export const runtime = 'nodejs';

const SIZE = { width: 1200, height: 630 };

// Load logo once at module level — cached across requests
const logoData = readFileSync(path.join(process.cwd(), 'public/images/logo.png'));
const logoSrc = `data:image/png;base64,${logoData.toString('base64')}`;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const conversation = await fetchConversationForMetadata(conversationId);

  const rawTitle = conversation?.title || 'Legal Conversation';
  const displayTitle = `Lawexa - ${rawTitle}`;
  const authorName = conversation?.author?.name || '';
  const agentName = conversation?.agent?.name || 'AI Assistant';
  const messageCount = conversation?.messages_count || 0;

  // Generic branded fallback for missing/private conversations
  if (!conversation) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} style={{ height: 60, width: 'auto', marginBottom: 24 }} alt="Lawexa" />
          <div style={{ color: '#8b8fa3', fontSize: 22, marginTop: 12 }}>
            Nigerian Legal Resources
          </div>
        </div>
      ),
      { ...SIZE }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          padding: '60px',
        }}
      >
        {/* Top bar with real logo */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} style={{ height: 50, width: 'auto' }} alt="Lawexa" />
        </div>

        {/* Title with "Lawexa - " prefix */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
          <div
            style={{
              color: '#ffffff',
              fontSize: displayTitle.length > 60 ? 36 : 48,
              fontWeight: 'bold',
              lineHeight: 1.3,
              maxWidth: 1080,
              overflow: 'hidden',
            }}
          >
            {displayTitle.length > 100 ? displayTitle.slice(0, 97) + '...' : displayTitle}
          </div>
        </div>

        {/* Bottom metadata */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginTop: '20px' }}>
          {authorName && (
            <span style={{ color: '#C9A227', fontSize: 18 }}>
              {authorName}
            </span>
          )}
          <span style={{ color: '#8b8fa3', fontSize: 16 }}>
            with {agentName}
          </span>
          {messageCount > 0 && (
            <span style={{ color: '#8b8fa3', fontSize: 16 }}>
              {messageCount} messages
            </span>
          )}
        </div>
      </div>
    ),
    { ...SIZE }
  );
}
