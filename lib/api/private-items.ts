// A user's own templates and skills, a firm's templates, and the ask-first
// requests in Space chats (thread 9ae498ae; Backend's contract, 19 November
// 2026). Every route answers 404 for an item that is not the caller's.

import { apiClient } from './client';
import type {
  FirmTemplate,
  ItemEnvelope,
  ItemsPage,
  MySkill,
  MySkillInput,
  MyTemplate,
  PrivateItemAnswer,
  PrivateItemChoice,
  PrivateItemKind,
  PrivateItemRequest,
  AllowedIn,
  BlankEdit,
  ItemVersionRow,
  MyTemplateDetail,
  SkillTestResult,
  SkillVersion,
  TemplateFacets,
  TemplateSort,
  TemplateUploadResult,
  TemplateVersion,
} from '@/types/private-items';

export interface ListParams {
  search?: string;
  page?: number;
  per_page?: number;
}

/** My templates' filters and sort (Backend, 19 November 2026). */
export interface TemplateListParams extends ListParams {
  document_type?: string;
  practice_area?: string;
  sort?: TemplateSort;
}

function filesForm(files: readonly File[]): FormData {
  const form = new FormData();
  for (const file of files) form.append('files[]', file);
  return form;
}

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

/** The server gives a test run up to 120 seconds; the app waits a little longer. */
export const SKILL_TEST_TIMEOUT_MS = 125_000;

/** Download a file the API streams, keeping its own name. */
async function download(path: string): Promise<Blob> {
  const response = await apiClient.get<Blob>(path, { responseType: 'blob' });
  return response.data;
}

export const myTemplatesApi = {
  list: async (params: TemplateListParams = {}) =>
    (await apiClient.get<ItemsPage<MyTemplate>>('/my/templates', { params })).data,
  facets: async () => (await apiClient.get<ItemEnvelope<TemplateFacets>>('/my/templates/facets')).data.data,
  get: async (uuid: string) => (await apiClient.get<ItemEnvelope<MyTemplateDetail>>(`/my/templates/${uuid}`)).data.data,
  /** Name, type or area; only the keys given change. */
  update: async (uuid: string, fields: { name?: string; document_type?: string | null; practice_area?: string | null }) =>
    (await apiClient.patch<ItemEnvelope<MyTemplate>>(`/my/templates/${uuid}`, fields)).data.data,
  duplicate: async (uuid: string) =>
    (await apiClient.post<ItemEnvelope<MyTemplate>>(`/my/templates/${uuid}/duplicate`)).data.data,
  /** A new file for the same template: it is read again, as an upload is, and keeps its history. */
  replace: async (uuid: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return (await apiClient.post<ItemEnvelope<MyTemplate>>(`/my/templates/${uuid}/replace`, form, MULTIPART)).data.data;
  },
  /** Applies the edits in order; any call (even with none) marks the blanks checked. */
  saveBlanks: async (uuid: string, edits: BlankEdit[]) =>
    (await apiClient.put<ItemEnvelope<MyTemplateDetail>>(`/my/templates/${uuid}/blanks`, { edits })).data.data,
  versions: async (uuid: string) =>
    (await apiClient.get<ItemEnvelope<ItemVersionRow[]>>(`/my/templates/${uuid}/versions`)).data.data,
  version: async (uuid: string, version: number) =>
    (await apiClient.get<ItemEnvelope<TemplateVersion>>(`/my/templates/${uuid}/versions/${version}`)).data.data,
  restore: async (uuid: string, version: number) =>
    (await apiClient.post<ItemEnvelope<MyTemplateDetail>>(`/my/templates/${uuid}/versions/${version}/restore`)).data.data,
  upload: async (files: readonly File[]) =>
    (await apiClient.post<ItemEnvelope<TemplateUploadResult<MyTemplate>>>('/my/templates', filesForm(files), MULTIPART)).data
      .data,
  rename: async (uuid: string, name: string) =>
    (await apiClient.patch<ItemEnvelope<MyTemplate>>(`/my/templates/${uuid}`, { name })).data.data,
  remove: async (uuid: string) => {
    await apiClient.delete(`/my/templates/${uuid}`);
  },
  retry: async (uuid: string) =>
    (await apiClient.post<ItemEnvelope<MyTemplate>>(`/my/templates/${uuid}/retry`)).data.data,
  download: (uuid: string) => download(`/my/templates/${uuid}/download`),
  /** "Save as my template" from a file sent in a chat. */
  fromFile: async (fileId: number, conversationUuid: string) =>
    (
      await apiClient.post<ItemEnvelope<MyTemplate>>('/my/templates/from-file', {
        file_id: fileId,
        conversation_uuid: conversationUuid,
      })
    ).data.data,
};

export const mySkillsApi = {
  list: async (params: ListParams = {}) => (await apiClient.get<ItemsPage<MySkill>>('/my/skills', { params })).data,
  get: async (uuid: string) => (await apiClient.get<ItemEnvelope<MySkill>>(`/my/skills/${uuid}`)).data.data,
  create: async (input: MySkillInput) => (await apiClient.post<ItemEnvelope<MySkill>>('/my/skills', input)).data.data,
  update: async (uuid: string, input: Partial<MySkillInput>) =>
    (await apiClient.patch<ItemEnvelope<MySkill>>(`/my/skills/${uuid}`, input)).data.data,
  duplicate: async (uuid: string) => (await apiClient.post<ItemEnvelope<MySkill>>(`/my/skills/${uuid}/duplicate`)).data.data,
  versions: async (uuid: string) =>
    (await apiClient.get<ItemEnvelope<ItemVersionRow[]>>(`/my/skills/${uuid}/versions`)).data.data,
  version: async (uuid: string, version: number) =>
    (await apiClient.get<ItemEnvelope<SkillVersion>>(`/my/skills/${uuid}/versions/${version}`)).data.data,
  restore: async (uuid: string, version: number) =>
    (await apiClient.post<ItemEnvelope<MySkill>>(`/my/skills/${uuid}/versions/${version}/restore`)).data.data,
  /**
   * Runs the steps on a sample request and returns the answer (one message,
   * charged only when an answer comes back). `instructions` and
   * `example_output` test an edit before it is saved. The server stops at 120
   * seconds (504, nothing charged), so this waits a little longer than that.
   */
  test: async (uuid: string, body: { request: string; instructions?: string; example_output?: string | null }) =>
    (await apiClient.post<ItemEnvelope<SkillTestResult>>(`/my/skills/${uuid}/test`, body, { timeout: SKILL_TEST_TIMEOUT_MS }))
      .data.data,
  /** The same test for a skill not saved yet (Backend, 19 November 2026): a 422 names the field. */
  testNew: async (body: { request: string; display_name: string; description: string; instructions: string; example_output?: string | null }) =>
    (await apiClient.post<ItemEnvelope<SkillTestResult>>('/my/skills/test', body, { timeout: SKILL_TEST_TIMEOUT_MS })).data.data,
  remove: async (uuid: string) => {
    await apiClient.delete(`/my/skills/${uuid}`);
  },
  /** "Save to my skills" from a skill Lawexa drafted in chat (kind "new" only). */
  fromDraft: async (draftUuid: string) =>
    (await apiClient.post<ItemEnvelope<MySkill>>(`/skill-drafts/${draftUuid}/save-mine`)).data.data,
};

export const firmTemplatesApi = {
  list: async (orgUuid: string, params: ListParams = {}) =>
    (await apiClient.get<ItemsPage<FirmTemplate>>(`/organizations/${orgUuid}/templates`, { params })).data,
  upload: async (orgUuid: string, files: readonly File[]) =>
    (
      await apiClient.post<ItemEnvelope<TemplateUploadResult<FirmTemplate>>>(
        `/organizations/${orgUuid}/templates`,
        filesForm(files),
        MULTIPART,
      )
    ).data.data,
  rename: async (orgUuid: string, uuid: string, name: string) =>
    (await apiClient.patch<ItemEnvelope<FirmTemplate>>(`/organizations/${orgUuid}/templates/${uuid}`, { name })).data.data,
  remove: async (orgUuid: string, uuid: string) => {
    await apiClient.delete(`/organizations/${orgUuid}/templates/${uuid}`);
  },
  retry: async (orgUuid: string, uuid: string) =>
    (await apiClient.post<ItemEnvelope<FirmTemplate>>(`/organizations/${orgUuid}/templates/${uuid}/retry`)).data.data,
  download: (orgUuid: string, uuid: string) => download(`/organizations/${orgUuid}/templates/${uuid}/download`),
};

export const privateItemGrantsApi = {
  list: async (filter: { kind?: PrivateItemKind; item?: string } = {}) =>
    (await apiClient.get<ItemEnvelope<AllowedIn[]>>('/private-item-grants', { params: filter })).data.data,
  /** End an "always in this Space" (the owner only). */
  revoke: async (grantUuid: string) => {
    await apiClient.delete(`/private-item-grants/${grantUuid}`);
  },
};

export const privateItemRequestsApi = {
  /** The caller's own pending requests in one chat; anyone else gets none. */
  list: async (conversationUuid: string) =>
    (
      await apiClient.get<ItemEnvelope<PrivateItemRequest[]>>('/private-item-requests', {
        params: { conversation: conversationUuid },
      })
    ).data.data,
  answer: async (uuid: string, choice: PrivateItemChoice) =>
    (await apiClient.post<ItemEnvelope<PrivateItemAnswer>>(`/private-item-requests/${uuid}/answer`, { choice })).data.data,
};
