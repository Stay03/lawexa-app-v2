import { MyChannelsFallback } from '@/v2/features/channels/my-channels/MyChannelsScreen';

/**
 * Route-level loading boundary for `/channels` — inside the `(index)` route
 * group so the LIST's shape wraps only the list, never `/channels/[channelId]`
 * beneath the same segment (which owns its own channel-shaped fallback).
 *
 * It renders the SAME component the screen exports, so route boundary → live
 * list is one continuous shape and nothing moves at the hand-off. The fallback
 * owns its `aria-hidden` + `inert` and its skeleton itself, so this file cannot
 * drift from it. That skeleton pulses here exactly as it does on the live
 * screen: one appearance for a wait, whichever boundary draws it (standards
 * section 8i).
 */
export default function MyChannelsLoading() {
  return <MyChannelsFallback />;
}
