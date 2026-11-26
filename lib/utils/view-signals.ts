/**
 * Where a reader came from and how they read (Stay, 26 November 2026: the
 * guest visits that jumped on 25 November; Backend's view-referrer-signals,
 * f9df9b4b). On the requests that open a case, a statute or a note, the app
 * says three things in headers, and when the reader leaves the page it says how
 * long it was visible and how far they scrolled.
 *
 * - `X-View-Referrer`: the page outside Lawexa the visit came from (the first
 *   page's `document.referrer`), origin and path only: a query can carry
 *   someone's token, code or email.
 * - `X-View-Landing`: the visit's first page, its path with only the campaign
 *   tags kept (utm_*, gclid, fbclid).
 * - `X-View-Client`: `{wd, sw, sh, tz, lang}`: whether the browser says it is
 *   automated (`navigator.webdriver`), the screen, the time zone and language.
 *
 * Both visit values are read once per tab, at the app's start, and kept in
 * sessionStorage, so every page of the visit sends the same. The server cleans
 * them again whatever arrives.
 *
 * A view the server recorded answers with `X-View-Token`. The tracker below
 * then times how long the page is visible and the furthest scroll, and on
 * leaving (the tab hidden or closed, or another page opened in the app) sends
 * `POST /api/views/leave` once, by `sendBeacon`, as text/plain (no preflight;
 * the token stands in for the login, which a beacon cannot carry). The first
 * leave of a view counts; the server ignores later ones.
 */

/** Campaign tags the landing page keeps (Backend keeps the same). */
export const LANDING_KEEPS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'] as const;
const MAX_URL = 1000;
const VISIT_KEY = 'lawexa-visit';

/**
 * Whether a request opens a case, a statute or a note, the requests the
 * server records a view on: the reader's read of one item (never a list, a
 * part of one, or a read ahead), a statute's text (`/export-akn`), and the
 * view a case page sends after a read ahead or a server read
 * (`POST /cases/{slug}/view`, case-view.ts).
 */
export function isViewRequest(method: string | undefined, url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0].replace(/^\/api(?=\/)/, '');
  const verb = (method ?? 'get').toLowerCase();
  if (verb === 'post') return /^\/cases\/[^/]+\/view$/.test(path);
  if (verb !== 'get') return false;
  // The statute's text (the reader's page reads it beside the statute; Backend records the view on either).
  if (/^\/statutes\/[^/]+\/export-akn$/.test(path)) return true;
  const match = /^\/(cases|statutes|notes)\/([^/]+)$/.exec(path);
  if (!match) return false;
  // The single-segment routes that are lists, not one item.
  if (match[1] === 'notes' && match[2] === 'my-notes') return false;
  if (match[1] === 'statutes' && match[2] === 'countries') return false;
  return true;
}

/** The page the visit came from: origin and path, or '' for none, ours, or not a web page. */
export function cleanReferrer(referrer: string, ownOrigin: string): string {
  if (!referrer) return '';
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return '';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
  if (url.origin === ownOrigin) return '';
  return `${url.origin}${url.pathname}`.slice(0, MAX_URL);
}

/** The visit's first page: its path, with only the campaign tags kept. */
export function cleanLanding(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return '';
  }
  const kept = new URLSearchParams();
  for (const key of LANDING_KEEPS) {
    const value = url.searchParams.get(key);
    if (value) kept.set(key, value);
  }
  const query = kept.toString();
  return `${url.pathname}${query ? `?${query}` : ''}`.slice(0, MAX_URL);
}

export interface ClientFacts {
  webdriver: boolean;
  screenWidth: number;
  screenHeight: number;
  timeZone: string;
  language: string;
}

/** `X-View-Client`'s JSON, each value cut to what the server keeps. */
export function clientJson(facts: ClientFacts): string {
  return JSON.stringify({
    wd: facts.webdriver,
    sw: Math.round(facts.screenWidth),
    sh: Math.round(facts.screenHeight),
    tz: facts.timeZone.slice(0, 64),
    lang: facts.language.slice(0, 35),
  });
}

/** How far down a scroller is read: the bottom of the view against the whole, 0 to 100. */
export function scrollPercent(scrollTop: number, clientHeight: number, scrollHeight: number): number {
  if (scrollHeight <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((scrollTop + clientHeight) / scrollHeight) * 100)));
}

// ── In the browser ───────────────────────────────────────────────────────

interface Visit {
  referrer: string;
  landing: string;
}

let visit: Visit | null = null;

/** Read the visit's referrer and first page once per tab (call at the app's start). */
export function captureVisit(): void {
  if (typeof window === 'undefined' || visit) return;
  try {
    const kept = window.sessionStorage.getItem(VISIT_KEY);
    if (kept) {
      visit = JSON.parse(kept) as Visit;
      return;
    }
  } catch {
    // No storage: read this page's own values.
  }
  visit = {
    referrer: cleanReferrer(document.referrer, window.location.origin),
    landing: cleanLanding(window.location.href),
  };
  try {
    window.sessionStorage.setItem(VISIT_KEY, JSON.stringify(visit));
  } catch {
    // Kept for this page only.
  }
}

/** The three headers for a view request. */
export function viewHeaders(): Record<string, string> {
  captureVisit();
  let timeZone = '';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    timeZone = '';
  }
  return {
    'X-View-Referrer': visit?.referrer ?? '',
    'X-View-Landing': visit?.landing ?? '',
    'X-View-Client': clientJson({
      webdriver: navigator.webdriver === true,
      screenWidth: window.screen?.width ?? 0,
      screenHeight: window.screen?.height ?? 0,
      timeZone,
      language: navigator.language ?? '',
    }),
  };
}

interface OpenView {
  token: string;
  path: string;
  visibleMs: number;
  visibleSince: number | null;
  scroll: number;
  /** The scroller the reader reads in: the tallest one that scrolled. */
  scrollerHeight: number;
}

let open: OpenView | null = null;
let leaveUrl = '';
let watching = false;
let pathTimer: ReturnType<typeof setInterval> | null = null;

const visibleNow = () => typeof document !== 'undefined' && document.visibilityState === 'visible';

function onScroll(event: Event) {
  if (!open) return;
  const target = event.target;
  const el = target instanceof Element ? target : document.scrollingElement;
  if (!el || el.scrollHeight <= el.clientHeight) return;
  // Only the main reading scroller counts: a short list scrolling beside it says nothing about the page.
  if (el.scrollHeight < open.scrollerHeight) return;
  open.scrollerHeight = el.scrollHeight;
  open.scroll = Math.max(open.scroll, scrollPercent(el.scrollTop, el.clientHeight, el.scrollHeight));
}

function onVisibility() {
  if (!open) return;
  if (document.visibilityState === 'hidden') {
    sendLeave();
    return;
  }
  if (open.visibleSince === null) open.visibleSince = Date.now();
}

function watch() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', () => sendLeave());
}

/** The view ends: how long it was visible and how far it was read, sent once. */
export function sendLeave(): void {
  const view = open;
  if (!view) return;
  open = null;
  if (pathTimer) {
    clearInterval(pathTimer);
    pathTimer = null;
  }
  const visibleMs = view.visibleMs + (view.visibleSince === null ? 0 : Date.now() - view.visibleSince);
  const body = JSON.stringify({ token: view.token, seconds: Math.min(86400, Math.round(visibleMs / 1000)), scroll: view.scroll });
  try {
    const blob = new Blob([body], { type: 'text/plain' });
    if (navigator.sendBeacon?.(leaveUrl, blob)) return;
    void fetch(leaveUrl, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => undefined);
  } catch {
    // A lost leave costs one view's timing, never the page.
  }
}

/**
 * The server recorded a view (`X-View-Token`): time it from now. A view still
 * open from an earlier page ends first; so does this one when the app moves to
 * another page.
 */
export function startView(token: string, apiBase: string): void {
  if (typeof window === 'undefined' || !token) return;
  if (open?.token === token) return;
  sendLeave();
  leaveUrl = `${apiBase}/api/views/leave`;
  watch();
  const root = document.scrollingElement;
  open = {
    token,
    path: window.location.pathname,
    visibleMs: 0,
    visibleSince: visibleNow() ? Date.now() : null,
    scroll: root ? scrollPercent(root.scrollTop, root.clientHeight, root.scrollHeight) : 0,
    scrollerHeight: 0,
  };
  // Another page opened in the app: this view has ended.
  pathTimer = setInterval(() => {
    if (open && window.location.pathname !== open.path) sendLeave();
  }, 1000);
}
