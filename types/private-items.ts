/**
 * A user's own templates and skills, and a firm's templates (Stay, thread
 * 9ae498ae, 18 and 19 November 2026; Backend's contract, 19 November 2026).
 *
 * Own items reach only their owner's chats. In a Space, Lawexa asks the owner
 * first ("just this time / always in this Space / no"), and "always" covers
 * the owner's own messages in that Space only. Only the owner can take an
 * "always" away.
 */

/** processing = Lawexa is reading it, live = ready to use, failed = `error` says why. */
export type TemplateStatus = 'processing' | 'live' | 'failed';

/** One Space where the owner said "always in this Space" (a grant). */
export interface AllowedIn {
  uuid: string;
  space: { uuid: string; name: string };
  item: { kind: PrivateItemKind; uuid: string; name: string };
  scope: 'always';
  created_at: string;
}

export interface TemplateFile {
  original_name: string;
  size: number;
  mime_type: string;
}

/** A row of GET /my/templates. */
export interface MyTemplate {
  uuid: string;
  name: string;
  status: TemplateStatus;
  /** Why reading failed; null otherwise. */
  error: string | null;
  /** Null for a template with no stored file (Backend's seeded rows): it shows no file line and no Download. */
  file: TemplateFile | null;
  /** How many blanks Lawexa marked (names, dates, amounts). */
  blanks_count: number | null;
  allowed_in: AllowedIn[];
  /** Tags for the filters (Backend, 19 November 2026); null until set or read. */
  document_type?: string | null;
  practice_area?: string | null;
  /** When Lawexa last drafted from it; null if never. */
  last_used_at?: string | null;
  /** Null until the person checks the blanks (any PUT .../blanks); a replaced file sets it back to null. */
  blanks_checked_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** One stretch of a template's text: plain words, or a blank by name ("TENANT NAME"). */
export type TemplateSegment = { type: 'text'; text: string } | { type: 'blank'; name: string };

/** A blank, how often it appears, and up to three short snippets around it. */
export interface TemplateBlank {
  name: string;
  count: number;
  examples: string[];
}

/** GET /my/templates/{uuid}: the row, plus its text in segments and its blanks. */
export interface MyTemplateDetail extends MyTemplate {
  /** The text with blanks as [NAME], for copying. */
  text: string;
  segments: TemplateSegment[];
  blanks: TemplateBlank[];
  version: number;
}

/** GET my/templates/facets: the person's own types and areas, with how many templates have each. */
export interface TemplateFacets {
  document_types: { value: string; count: number }[];
  practice_areas: { value: string; count: number }[];
}

export type TemplateSort = 'last_used' | 'name' | 'created';

/** One change to a template's blanks, applied in order by PUT .../blanks. */
export type BlankEdit =
  | { op: 'rename'; from: string; to: string }
  | { op: 'merge'; blanks: string[]; to: string }
  /** `text` is what the blank becomes in the document; "" takes it out. */
  | { op: 'remove'; blank: string; text: string }
  /** Every occurrence of `passage` becomes [blank]. */
  | { op: 'add'; passage: string; blank: string };

/** A row of GET .../versions, newest first. */
export interface ItemVersionRow {
  version: number;
  created_at: string;
  by: { uuid: string; name: string } | null;
  /** Templates only. */
  blanks_count?: number | null;
  file?: { original_name: string } | null;
}

/** GET my/templates/{uuid}/versions/{v}. */
export interface TemplateVersion extends ItemVersionRow {
  segments: TemplateSegment[];
  blanks: TemplateBlank[];
}

/** GET my/skills/{uuid}/versions/{v}. */
export interface SkillVersion extends ItemVersionRow {
  display_name: string;
  description: string;
  instructions: string;
  example_output: string | null;
}

/**
 * A skill test run (Backend, 19 November 2026): started by POST .../test
 * (202), then read until it is done or failed. An answer costs one message;
 * a failed run costs nothing.
 */
export interface SkillTestRun {
  uuid: string;
  status: 'running' | 'done' | 'failed';
  answer: string | null;
  error: { message: string } | null;
  created_at: string;
}

/** An item the person picked with "Use in chat" (POST /chat `use_items`). */
export interface UseItem {
  kind: PrivateItemKind;
  uuid: string;
}

/** A row of GET /organizations/{uuid}/templates: shared with every member, no grants. */
export interface FirmTemplate extends Omit<MyTemplate, 'allowed_in'> {
  uploaded_by: { uuid: string; name: string } | null;
}

/** Why an upload refused a file. */
export type UploadRefusal = 'type' | 'size' | 'duplicate';

/** POST /my/templates (and the firm's): what was taken and what was refused. */
export interface TemplateUploadResult<Row> {
  created: Row[];
  refused: { original_name: string; reason: UploadRefusal }[];
}

/** A row of GET /my/skills. */
export interface MySkill {
  uuid: string;
  /** snake_case, made from `display_name` when not given. */
  name: string;
  display_name: string;
  description: string;
  instructions: string;
  /** An example of a good answer, which Lawexa matches; optional. */
  example_output?: string | null;
  /** Off: Lawexa never picks it. */
  is_active?: boolean;
  version: number;
  allowed_in: AllowedIn[];
  /** When Lawexa last loaded it; null if never. */
  last_used_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Create and edit body for a skill. */
export interface MySkillInput {
  display_name: string;
  /** The "When Lawexa uses it" line: Lawexa picks skills from this. */
  description: string;
  instructions: string;
  example_output?: string | null;
  is_active?: boolean;
}

export type PrivateItemKind = 'template' | 'skill';

/** A request to use one of the owner's items in a Space chat; only its owner reads it. */
export interface PrivateItemRequest {
  uuid: string;
  conversation_uuid: string;
  space_uuid: string | null;
  /** The turn that asked: the card sits under that turn's reply. */
  execution_id: string;
  item: { kind: PrivateItemKind; uuid: string; name: string };
  status: 'pending' | 'once' | 'always' | 'declined' | 'expired';
  expires_at: string;
  answered_at: string | null;
  created_at: string;
}

export type PrivateItemChoice = 'once' | 'always' | 'no';

/**
 * POST /private-item-requests/{uuid}/answer. `resumed` names the turn a yes
 * started; null when Lawexa is still answering in that chat or the person has
 * no messages left, and then their next message picks up the yes.
 */
export interface PrivateItemAnswer extends PrivateItemRequest {
  resumed: { execution_id: string; conversation_uuid: string } | null;
}

/** On an assistant message: whose own item Lawexa used. `name` is the owner's to see only. */
export interface UsedPrivateItem {
  kind: PrivateItemKind;
  owner: { uuid: string; name: string };
  name: string | null;
}

/** The limits Backend states for a template upload. */
export const TEMPLATE_UPLOAD = {
  accept: '.docx,.doc,.rtf,.pdf',
  maxBytes: 20 * 1024 * 1024,
  maxFiles: 10,
} as const;

/** A page of a list: rows in `data`, page numbers in `pagination` (the ApiResponse trait's shape). */
export interface ItemsPage<Row> {
  success: boolean;
  message: string;
  data: Row[];
  pagination: { current_page: number; last_page: number; per_page: number; total: number };
}

/** One row, as every single-item route answers. */
export interface ItemEnvelope<Row> {
  success: boolean;
  message: string;
  data: Row;
}
