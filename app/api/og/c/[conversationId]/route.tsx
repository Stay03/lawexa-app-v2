import { ImageResponse } from 'next/og';
import { fetchConversationForMetadata } from '@/lib/api/server';
import { getAppUrl } from '@/lib/constants/seo';

export const runtime = 'nodejs';

const SIZE = { width: 1200, height: 630 };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const conversation = await fetchConversationForMetadata(conversationId);

  // Logo served from public directory — Satori fetches it by URL
  const logoUrl = `${getAppUrl()}/images/logo.png`;

  const title = conversation?.title || 'Legal Conversation';
  const authorName = conversation?.author?.name || '';
  const agentName = conversation?.agent?.name || 'AI Assistant';

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
          <img src={logoUrl} height={60} alt="Lawexa" />
          <div style={{ color: '#8b8fa3', fontSize: 22, marginTop: 24 }}>
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
        {/* Top bar with logo */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} height={50} alt="Lawexa" />
        </div>

        {/* Title — raw conversation title, no prefix */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
          <div
            style={{
              color: '#ffffff',
              fontSize: title.length > 60 ? 36 : 48,
              fontWeight: 'bold',
              lineHeight: 1.3,
              maxWidth: 1080,
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
        </div>
      </div>
    ),
    { ...SIZE }
  );
}
