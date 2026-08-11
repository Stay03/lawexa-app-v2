/**
 * ── "NIGERIAN" CAME OUT ON PURPOSE (@arthur, 2026-08-11) ────────────────────
 * Every link anybody shares — and now every ambassador referral link — unfurled
 * as "Lawexa · Nigerian Legal Resources · Access Nigerian law cases, notes and
 * legal research materials". That undersells what the product became: statutes
 * carry country tabs, cases span jurisdictions, and the app is used to draft
 * and study, not only to look things up. Arthur supplied this wording; it is
 * used verbatim in all three places the old line appeared — the title, the
 * description, and the picture (`app/opengraph-image.tsx`), which had it drawn
 * into the image and would otherwise have kept saying it on its own.
 */
export const SEO = {
  siteName: 'Lawexa',
  defaultTitle: 'Lawexa - Where Modern Legal Work Happens',
  defaultDescription:
    'Lawexa powers lawyers, students, and teams to research cases and laws across jurisdictions, draft, study, and collaborate with AI to get legal work done faster and reliably',
  themeColor: '#C9A227',
  twitterHandle: '@LawexaAi',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  locale: 'en_NG',
} as const;

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://lawexa.com';
}

export function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}
