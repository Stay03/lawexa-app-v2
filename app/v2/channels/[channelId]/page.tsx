import type { Metadata } from 'next';
import { ChannelScreen } from '@/v2/features/channels/screen/ChannelScreen';
import { parseChannelTab } from '@/v2/features/channels/model';

/**
 * v2 `/channels/[channelId]` — the thin server shell (phase-5 W2 item 1).
 *
 * PRIVATE SURFACE CONVENTIONS: `noindex` (a members-only room must never be
 * crawled — the sitemap and the metadata convention's public-route rules do
 * not apply), no `generateMetadata` data fetch and NO server prefetch — the
 * channel detail is viewer-scoped, membership-gated and realtime-fed, so the
 * client cache (warmed by the spine's baselines and retained by
 * `GC_TIMES.list`) is the right first paint, not a per-request server fetch.
 *
 * URL STATE, THREADED AS NAVIGATION-TIME PROPS: `?tab=` / `?list=` / `?m=` /
 * `?game=` (the W6 live-quiz mode) are read here (the page is already dynamic
 * — the v2 layout reads cookies) and handed to the screen as INITIAL values. In-app changes are quiet
 * history writes owned by the screen; a real navigation (a shared link, the
 * dispatcher's mention toast) re-renders this page and the new props re-arm
 * the screen's deep-link/tab state. `loading.tsx` takes no params, which is
 * fine — its fallback is tab-agnostic chrome.
 *
 * `key={channelId}` remounts the screen wholesale per channel, so scroll
 * baselines, the unread anchor, tab/reply state and dialogs can never leak
 * across channels (v1 keyed its body for the same reason).
 *
 * LIVE SINCE W5 (manifest entry `/channels/*`): this page is the landing spot
 * for BOTH notification paths — the dispatcher's mention toast and the service
 * worker's `notificationclick` — because both open the same
 * `/channels/{uuid}?m={message}` URL and `?m=` is read right here.
 */

export const metadata: Metadata = {
  title: 'Channel',
  robots: { index: false, follow: false },
};

interface ChannelPageProps {
  params: Promise<{ channelId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** First string value of a possibly-repeated search param, else null. */
function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function V2ChannelPage({
  params,
  searchParams,
}: ChannelPageProps) {
  const [{ channelId }, search] = await Promise.all([params, searchParams]);

  return (
    <ChannelScreen
      key={channelId}
      channelUuid={channelId}
      initialTab={parseChannelTab(firstParam(search.tab))}
      initialListUuid={firstParam(search.list)}
      initialGameUuid={firstParam(search.game)}
      targetMessageUuid={firstParam(search.m)}
    />
  );
}
