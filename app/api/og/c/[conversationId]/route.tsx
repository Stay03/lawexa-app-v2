import { ImageResponse } from 'next/og';
import { fetchConversationForMetadata } from '@/lib/api/server';

export const runtime = 'nodejs';

const SIZE = { width: 1200, height: 630 };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const conversation = await fetchConversationForMetadata(conversationId);

  const title = conversation?.title || 'Lawexa Conversation';
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
          <div
            style={{
              width: 64,
              height: 64,
              backgroundColor: '#C9A227',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 32,
              fontWeight: 'bold',
              marginBottom: 24,
            }}
          >
            L
          </div>
          <div style={{ color: '#C9A227', fontSize: 48, fontWeight: 'bold' }}>
            LAWEXA
          </div>
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
        {/* Top bar with branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
          <div
            style={{
              width: 48,
              height: 48,
              backgroundColor: '#C9A227',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 24,
              fontWeight: 'bold',
            }}
          >
            L
          </div>
          <span style={{ color: '#C9A227', fontSize: 28, fontWeight: 'bold' }}>
            LAWEXA
          </span>
        </div>

        {/* Title */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
          <div
            style={{
              color: '#ffffff',
              fontSize: title.length > 60 ? 36 : 48,
              fontWeight: 'bold',
              lineHeight: 1.3,
              maxWidth: 900,
              overflow: 'hidden',
            }}
          >
            {title.length > 100 ? title.slice(0, 97) + '...' : title}
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
