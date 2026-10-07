import type { PerfLayer } from '@/v2/runtime/perf-switch';

/**
 * The words on the performance-layer switches, exactly as the owner approved
 * them (7 October 2026, techlead f64f37ae, owner c9f880f2). Change them only
 * with the owner: each line is a promise about what the switch does.
 */
export const PERF_LAYERS_HEADING = 'Performance layers (this browser only)';

export interface PerfLayerCopy {
  layer: PerfLayer;
  label: string;
  on: string;
  off: string;
}

export const PERF_LAYER_COPY: readonly PerfLayerCopy[] = [
  {
    layer: 'ssr',
    label: 'Server-side rendering (SSR) of case pages',
    on: 'The server includes the case data in the page, so the case shows as soon as the page opens.',
    off: 'The page opens with a loading skeleton, and the browser then fetches the case from the API.',
  },
  {
    layer: 'idb',
    label: 'IndexedDB query cache (lawexa-query-cache)',
    on: 'API responses for notes, chats and lists are stored on this device. When you reopen the app, they show from storage first, then refresh from the API.',
    off: 'Nothing is stored on this device. A reopened note, chat or list loads from the API only, about 0.5 to 1.5 s later. Case pages are not affected.',
  },
  {
    layer: 'route',
    label: 'Route prefetch on hover or touch (Next.js router.prefetch)',
    on: "When you hover over or touch a search result, the browser loads that page's route in advance, so the page appears faster after the click.",
    off: 'The route loads only after the click, so the page appears a moment later.',
  },
  {
    layer: 'read',
    label: 'Case prefetch on hover (X-Lawexa-Prefetch)',
    on: 'When you hover over a search result for 1 to 2 seconds, the browser fetches the case in advance, without counting a view. The case then shows immediately after the click. Requires route prefetch to be on.',
    off: 'The case is fetched only after the click, and the loading skeleton shows until it arrives.',
  },
];
