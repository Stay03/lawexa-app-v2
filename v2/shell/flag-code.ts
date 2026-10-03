/**
 * Country codes that are not ISO 3166-1 alpha-2, mapped to the artwork's
 * name. Our data carries "UK" for the United Kingdom (a case's `country.code`;
 * a statute also has `iso_alpha2: "GB"`), and the artwork has no `fi-uk`, so
 * every UK case and the Wills Act showed an empty grey box (3 October 2026).
 */
const FLAG_ALIASES: Record<string, string> = {
  uk: 'gb',
};

/** The artwork's name for a country code, any case. */
export function flagArtworkCode(code: string): string {
  const lower = code.trim().toLowerCase();
  return FLAG_ALIASES[lower] ?? lower;
}
