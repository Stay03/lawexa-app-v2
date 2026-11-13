import type { RedactionCategory } from '@/types/redaction';

/**
 * The five kinds of text a redacted chat can hide, in the server's order
 * (Backend's RedactionCategory, 62fd6f65), and how a chat says which it hides.
 * The new-chat choice takes its labels and descriptions from the server; an
 * open chat names its own choice with the short words below, so it needs no
 * request to say what it hides.
 */
export const REDACTION_CATEGORIES: readonly RedactionCategory[] = ['names', 'addresses', 'contacts', 'identity', 'financial'];

const SHORT: Readonly<Record<RedactionCategory, string>> = {
  names: 'names',
  addresses: 'addresses',
  contacts: 'phone numbers and emails',
  identity: 'ID numbers and dates of birth',
  financial: 'bank and card numbers',
};

function isCategory(value: unknown): value is RedactionCategory {
  return typeof value === 'string' && (REDACTION_CATEGORIES as readonly string[]).includes(value);
}

/**
 * A chat's choice from its record: the known keys in the server's order, or
 * null when the record names none (a redacted chat made before choices, which
 * hides everything, or a chat that is not redacted).
 */
export function readRedactionCategories(value: unknown): RedactionCategory[] | null {
  if (!Array.isArray(value)) return null;
  const known = REDACTION_CATEGORIES.filter((key) => value.includes(key));
  return known.length > 0 ? known : null;
}

/** The choice in the server's order, repeats and unknown keys dropped. */
export function orderedCategories(keys: readonly unknown[]): RedactionCategory[] {
  return REDACTION_CATEGORIES.filter((key) => keys.some((value) => value === key && isCategory(value)));
}

/** "names, addresses and phone numbers and emails"; every kind (or an older chat's null) is "everything it can". */
export function hiddenSummary(categories: readonly RedactionCategory[] | null): string {
  if (categories === null || categories.length === REDACTION_CATEGORIES.length) return 'everything it can';
  const words = orderedCategories(categories).map((key) => SHORT[key]);
  if (words.length <= 1) return words[0] ?? 'everything it can';
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

/** Turn one kind on or off, keeping at least one on: the last one cannot be turned off. */
export function toggleCategory(current: readonly RedactionCategory[], key: RedactionCategory): RedactionCategory[] {
  const on = current.includes(key);
  if (on && current.length === 1) return [...current];
  return orderedCategories(on ? current.filter((value) => value !== key) : [...current, key]);
}

/** Whether two choices hide the same kinds. */
export function sameCategories(a: readonly RedactionCategory[], b: readonly RedactionCategory[]): boolean {
  const left = orderedCategories(a);
  const right = orderedCategories(b);
  return left.length === right.length && left.every((key, at) => key === right[at]);
}
