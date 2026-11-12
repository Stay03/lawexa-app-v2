import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';

import { SEO, getAppUrl } from '@/lib/constants/seo';
import { WRAPPED_COLOURS } from '@/lib/wrapped/theme';
import { wrappedBody, wrappedDisplay } from './fonts';
import './wrapped.css';

/**
 * lawexa.com/wrapped: Lawexa Wrapped, Bar Finals edition (thread f833c285,
 * live 8 November 2026). A root route on purpose, like app/quiz-results: one
 * page answers everybody, signed in or out, with or without the v2 cookie, and
 * a link preview on WhatsApp gets this page's title and image. So it imports
 * only the shared layers (components, lib, types), never v2/.
 */

const title = 'Lawexa Wrapped: Bar Finals 2026';
const description = 'Your Bar Finals year on Lawexa, in eight cards. The Law. The Bar. The Bench. Get yours.';

/**
 * The link-preview picture, 1200×630, from Arthur's art for vibe 14 and the
 * campaign line. Set in both blocks: this route's `openGraph` replaces the
 * root's whole, so the root opengraph-image is not inherited.
 */
const image = { url: '/wrapped/og.png', width: 1200, height: 630, alt: 'Your Bar Finals Report is out. The Law. The Bar. The Bench. Lawexa Wrapped.' };

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/wrapped' },
  openGraph: { title, description, url: `${getAppUrl()}/wrapped`, siteName: SEO.siteName, type: 'website', images: [image] },
  twitter: { card: 'summary_large_image', title, description, images: [image] },
};

/** The palette as CSS variables (`--wr-cream`, `--wr-ink-soft`, …), so CSS and the canvas share one source. */
const palette = Object.fromEntries(
  Object.entries(WRAPPED_COLOURS).map(([name, value]) => [`--wr-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, value]),
) as CSSProperties;

export const viewport: Viewport = {
  themeColor: WRAPPED_COLOURS.ink,
  viewportFit: 'cover',
};

export default function WrappedLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`wrapped-root ${wrappedDisplay.variable} ${wrappedBody.variable}`} style={palette}>
      {children}
    </div>
  );
}
