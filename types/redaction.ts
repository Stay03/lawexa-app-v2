/**
 * What a redacted chat hides (Stay, 14 November 2026, thread cce2eafe: six
 * choices, phone numbers and emails apart). Backend's RedactionCategory
 * (20dce5a2): each key maps to the redaction service's entity types; every
 * other kind of text is left as written. A chat's choice is fixed when it is made.
 */
export type RedactionCategory = 'names' | 'addresses' | 'phones' | 'emails' | 'identity' | 'financial';

/** One choice, as the server names and explains it. */
export interface RedactionCategoryOption {
  key: RedactionCategory;
  /** The menu's name for it: "Phone numbers". */
  label: string;
  /** The name a line or a pill uses, short enough for a phone: "phone numbers". */
  short_label: string;
  description: string;
}

/**
 * `GET` / `PUT /users/redaction-default`: the person's saved choice (for a
 * person who has not chosen, the server's starting kinds) and the six options.
 */
export interface RedactionDefault {
  categories: RedactionCategory[];
  options: RedactionCategoryOption[];
}

export interface RedactionDefaultResponse {
  success: boolean;
  message?: string;
  data: RedactionDefault;
}
