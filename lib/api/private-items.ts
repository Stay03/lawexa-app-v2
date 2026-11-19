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
  TemplateUploadResult,
} from '@/types/private-items';

export interface ListParams {
  search?: string;
  page?: number;
  per_page?: number;
}

function filesForm(files: readonly File[]): FormData {
  const form = new FormData();
  for (const file of files) form.append('files[]', file);
  return form;
}

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

/** Download a file the API streams, keeping its own name. */
async function download(path: string): Promise<Blob> {
  const response = await apiClient.get<Blob>(path, { responseType: 'blob' });
  return response.data;
}

export const myTemplatesApi = {
  list: async (params: ListParams = {}) =>
    (await apiClient.get<ItemsPage<MyTemplate>>('/my/templates', { params })).data,
  get: async (uuid: string) => (await apiClient.get<ItemEnvelope<MyTemplate>>(`/my/templates/${uuid}`)).data.data,
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
  update: async (uuid: string, input: MySkillInput) =>
    (await apiClient.patch<ItemEnvelope<MySkill>>(`/my/skills/${uuid}`, input)).data.data,
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
