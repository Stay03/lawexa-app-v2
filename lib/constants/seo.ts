export const SEO = {
  siteName: 'Lawexa',
  defaultTitle: 'Lawexa - Nigerian Legal Resources',
  defaultDescription: 'Access Nigerian law cases, notes, and legal research materials',
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
