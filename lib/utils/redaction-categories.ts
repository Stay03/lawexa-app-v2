import type { RedactionCategory } from '@/types/redaction';

/**
 * The five kinds of text a redacted chat can hide, in the server's order
 * (Backend's RedactionCategory, 62fd6f65), and how a chat says which it hides.
 * The new-chat choice takes its labels and descriptions from the server; an
 * open chat names its own choice with the short words below, so it needs no
 * request to say what it hides.
 */
export const REDACTION_CATEGORIES: readonly RedactionCategory[] = ['names', 'addresses', 'contacts', 'identity', 'financial'];

// Short enough that a phone's line keeps four of them (Techlead, 14 November 2026); the menu keeps the long labels.
const SHORT: Readonly<Record<RedactionCategory, string>> = {
  names: 'names',
  addresses: 'addresses',
  contacts: 'contacts',
  identity: 'IDs',
  financial: 'accounts',
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

/**
 * Every kind a chat hides, by its short name: "names, addresses, contacts".
 * An older redacted chat's null hides all five (it was made before choices).
 */
export function hiddenList(categories: readonly RedactionCategory[] | null): string {
  const keys = categories === null ? REDACTION_CATEGORIES : orderedCategories(categories);
  return (keys.length > 0 ? keys : REDACTION_CATEGORIES).map((key) => SHORT[key]).join(', ');
}

/** What a chat hides, short enough for a phone's line: the kinds by name, or "all 5 kinds" for every kind (and an older chat). */
export function hiddenSummary(categories: readonly RedactionCategory[] | null): string {
  if (categories === null || orderedCategories(categories).length === REDACTION_CATEGORIES.length) {
    return `all ${REDACTION_CATEGORIES.length} kinds`;
  }
  return hiddenList(categories);
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
