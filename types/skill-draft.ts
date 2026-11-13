/**
 * Skill drafts (the skills tool, thread 2b436b4f; Arthur's 1A 2A 3A 4B).
 *
 * Lawexa drafts a skill in a person's chat; the person saves it for an admin;
 * an admin edits it beside the live skill, then publishes or rejects it. An
 * admin can also import a SKILL.md zip as a draft. Shapes as the server sends
 * them (lawexa-api `AiSkillDraftResource`, `SkillDrafts::cardOf`, branch
 * skills-tool 385ececc).
 */

export type SkillDraftStatus = 'proposed' | 'pending' | 'dismissed' | 'published' | 'rejected';
export type SkillDraftKind = 'new' | 'change';
export type SkillLoadMode = 'on_demand' | 'always_on';

/**
 * The card a chat's answer carries (`metadata.type` "skill_draft", and the v2
 * `completed` event's `skill_draft`): enough to draw it closed. The server
 * rewrites it on every change, an admin's included, so a read of the chat
 * shows where the draft stands.
 */
export interface SkillDraftCard {
  status: SkillDraftStatus;
  /** The draft's uuid. */
  draft: string;
  kind: SkillDraftKind;
  /** The skill's snake_case name: the new one's, or the skill a change is for. */
  name: string | null;
  displayName: string;
  description: string;
}

/** A person, by uuid and name only. */
export interface SkillDraftPerson {
  uuid: string;
  name: string;
}

/** The live skill beside a change. */
export interface SkillDraftLive {
  id: number;
  version: number;
  is_active: boolean;
  deleted: boolean;
  display_name: string;
  description: string;
  instructions: string;
  load_mode: SkillLoadMode;
  /** The live skill has moved on from the version the draft was written against. */
  changed_since_draft: boolean;
}

/** The version a change was drafted against, when the live one has moved on. */
export interface SkillDraftBase {
  version: number;
  display_name: string;
  description: string;
  instructions: string;
  load_mode: SkillLoadMode;
}

/** A whole draft: GET /api/skill-drafts/{uuid} and the admin's drafts. */
export interface SkillDraft {
  uuid: string;
  status: SkillDraftStatus;
  source: 'chat' | 'zip';
  kind: SkillDraftKind;
  name: string | null;
  display_name: string;
  description: string;
  instructions: string;
  load_mode: SkillLoadMode;
  change_note: string | null;
  base_version: number | null;
  live: SkillDraftLive | null;
  base: SkillDraftBase | null;
  conversation: string | null;
  created_by: SkillDraftPerson | null;
  reviewed_by: SkillDraftPerson | null;
  reviewed_at: string | null;
  review_note: string | null;
  published_version: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SkillDraftResponse {
  success: boolean;
  message: string;
  data: SkillDraft;
}

// ── Admin AI Skills' drafts (superadmin) ─────────────────────────────────────

/** The admin list shows waiting, published or rejected drafts; never a person's unsaved one. */
export type AdminSkillDraftListStatus = 'pending' | 'published' | 'rejected';

export interface AdminSkillDraftsResponse {
  success: boolean;
  message: string;
  data: {
    drafts: SkillDraft[];
    pagination: { current_page: number; last_page: number; per_page: number; total: number };
  };
}

/** An admin's edit. `name` only for a new skill; the limits are the skill form's. */
export interface AdminSkillDraftEdit {
  name?: string;
  display_name?: string;
  description?: string;
  instructions?: string;
  load_mode?: SkillLoadMode;
  change_note?: string | null;
}

/** The live skill as published, as admin AI Skills reads skills elsewhere. */
export interface AdminPublishedSkill {
  id: number;
  name: string;
  display_name: string;
  version: number;
  is_active: boolean;
}

export interface AdminSkillDraftPublishResponse {
  success: boolean;
  /** "Published as version N." or "Published as a new skill, switched off. …" */
  message: string;
  data: { draft: SkillDraft; skill: AdminPublishedSkill };
}

export interface AdminSkillDraftImportResponse {
  success: boolean;
  /** Says how many other files were skipped. */
  message: string;
  data: { draft: SkillDraft; skipped_files: string[] };
}
