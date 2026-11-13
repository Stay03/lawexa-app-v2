/**
 * What a redacted chat hides (Stay, 13 November 2026, thread cce2eafe: "only
 * the 5"). Backend's RedactionCategory (62fd6f65): each key maps to the
 * redaction service's entity types; every other kind of text is left as
 * written. A chat's choice is fixed when it is made.
 */
export type RedactionCategory = 'names' | 'addresses' | 'contacts' | 'identity' | 'financial';

/** One choice, as the server names and explains it. */
export interface RedactionCategoryOption {
  key: RedactionCategory;
  label: string;
  description: string;
}

/** `GET` / `PUT /users/redaction-default`: the person's saved choice (all five for a new user) and the five options. */
export interface RedactionDefault {
  categories: RedactionCategory[];
  options: RedactionCategoryOption[];
}

export interface RedactionDefaultResponse {
  success: boolean;
  message?: string;
  data: RedactionDefault;
}
