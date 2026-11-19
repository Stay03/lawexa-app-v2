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

/** One Space where the owner said "always in this Space". */
export interface AllowedIn {
  grant_uuid: string;
  space: { uuid: string; name: string };
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
  file: TemplateFile;
  /** How many blanks Lawexa marked (names, dates, amounts). */
  blanks_count: number | null;
  allowed_in: AllowedIn[];
  created_at: string;
  updated_at: string;
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
  version: number;
  allowed_in: AllowedIn[];
  created_at: string;
  updated_at: string;
}

/** Create and edit body for a skill. */
export interface MySkillInput {
  display_name: string;
  description: string;
  instructions: string;
}

export type PrivateItemKind = 'template' | 'skill';

/** A request to use one of the owner's items in a Space chat; only its owner reads it. */
export interface PrivateItemRequest {
  uuid: string;
  conversation_uuid: string;
  space_uuid: string | null;
  item: { kind: PrivateItemKind; uuid: string; name: string };
  status: 'pending' | 'once' | 'always' | 'declined' | 'expired';
  expires_at: string;
  created_at: string;
}

export type PrivateItemChoice = 'once' | 'always' | 'no';

/** POST /private-item-requests/{uuid}/answer. `resumed` comes with once or always. */
export interface PrivateItemAnswer extends PrivateItemRequest {
  resumed?: { execution_id: string; conversation_uuid: string } | null;
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
