import type { RedactionCategory, RedactionCategoryOption } from '@/types/redaction';

/**
 * The six kinds of text a redacted chat can hide, in the server's order
 * (Backend's RedactionCategory, 20dce5a2), and how a chat says which it hides.
 * The server names each kind twice: a label for the menu ("Phone numbers") and
 * a short label for a line or a pill ("phone numbers"). Both come from it.
 */
export const REDACTION_CATEGORIES: readonly RedactionCategory[] = ['names', 'addresses', 'phones', 'emails', 'identity', 'financial'];

/** Each kind's short name from the server ("phone numbers", "IDs"), by key. */
export type ShortLabels = Readonly<Partial<Record<RedactionCategory, string>>>;

function isCategory(value: unknown): value is RedactionCategory {
  return typeof value === 'string' && (REDACTION_CATEGORIES as readonly string[]).includes(value);
}

/** The short names from the server's options, by key. */
export function shortLabelsOf(options: readonly RedactionCategoryOption[]): ShortLabels {
  return Object.fromEntries(options.filter((option) => isCategory(option.key)).map((option) => [option.key, option.short_label]));
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
 * Every kind a chat hides, by its short name: "names, addresses, phone
 * numbers". An older redacted chat's null hides all six (it was made before
 * choices). Null while a short name is not known yet, so nothing half-named shows.
 */
export function hiddenList(categories: readonly RedactionCategory[] | null, labels: ShortLabels): string | null {
  const chosen = categories === null ? [] : orderedCategories(categories);
  const keys = chosen.length > 0 ? chosen : REDACTION_CATEGORIES;
  const words = keys.map((key) => labels[key]);
  return words.every((word): word is string => typeof word === 'string' && word !== '') ? words.join(', ') : null;
}

/**
 * What a chat hides, short enough for a phone's line: the kinds by name, or
 * "all 6 kinds" for every kind (and an older chat). Null while a short name is
 * not known yet.
 */
export function hiddenSummary(categories: readonly RedactionCategory[] | null, labels: ShortLabels): string | null {
  if (categories === null || orderedCategories(categories).length === REDACTION_CATEGORIES.length) {
    return `all ${REDACTION_CATEGORIES.length} kinds`;
  }
  return hiddenList(categories, labels);
}

/** The same as a count, for a line too narrow for the names: "4 of 6 kinds", or "all 6 kinds". */
export function hiddenCount(categories: readonly RedactionCategory[] | null): string {
  const total = REDACTION_CATEGORIES.length;
  const count = categories === null ? total : orderedCategories(categories).length;
  return count === total || count === 0 ? `all ${total} kinds` : `${count} of ${total} kinds`;
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
