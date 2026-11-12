import { apiClient } from './client';
import { filenameFromDisposition, type ExportedFile } from './export';
import {
  certificateFileName,
  listItems,
  pageOf,
  readIssueResult,
  readPendingCertificates,
  type PageOf,
} from '@/lib/certificates/model';
import type { ApiResponse } from '@/types/api';
import type {
  CertificatePreviewPayload,
  CertificateProgramme,
  CertificateProgrammePayload,
  CertificateTemplate,
  CertificateTemplatePayload,
  IssueCertificatesPayload,
  IssueCertificatesResult,
  IssuedCertificate,
  MyCertificate,
  PendingCertificate,
  QuizCertificateLink,
} from '@/types/certificates';

/**
 * Certificates (shapes agreed with WOZ in 384c, 11 November 2026; see
 * certificates-shapes.md in that thread). The public verify check lives in
 * `certificates-public.ts` because it must not go through `apiClient`.
 */

const enc = encodeURIComponent;

async function pdf(url: string, fallbackName: string, init?: { method: 'post'; body: unknown }): Promise<ExportedFile> {
  const response =
    init?.method === 'post'
      ? await apiClient.post<Blob>(url, init.body, { responseType: 'blob' })
      : await apiClient.get<Blob>(url, { responseType: 'blob' });
  return { blob: response.data, filename: filenameFromDisposition(response.headers['content-disposition'], fallbackName) };
}

/** Signed in: my certificates and their PDFs. */
export const certificatesApi = {
  mine: async (): Promise<MyCertificate[]> => {
    const response = await apiClient.get<ApiResponse<unknown>>('/certificates');
    return listItems<MyCertificate>(response.data.data);
  },

  /** Owner only. */
  download: (number: string): Promise<ExportedFile> =>
    pdf(`/certificates/${enc(number)}/download`, certificateFileName(number)),

  /** Certificates waiting for their printed name (part 2). */
  pending: async (): Promise<PendingCertificate[]> => {
    const response = await apiClient.get<ApiResponse<unknown>>('/certificates/pending');
    return readPendingCertificates(response.data.data);
  },

  /**
   * Confirms the printed name and issues the certificate: 201 the first time,
   * 200 with the same certificate on a repeat, so a double tap is safe. 422
   * with `errors.printed_name` for a name outside 2 to 120 characters.
   */
  confirmName: async (pendingUuid: string, printedName: string): Promise<MyCertificate> => {
    const response = await apiClient.post<ApiResponse<MyCertificate>>(`/certificates/pending/${enc(pendingUuid)}/confirm`, {
      printed_name: printedName,
    });
    return response.data.data as MyCertificate;
  },
};

const TEMPLATES = '/admin/certificate-templates';
const PROGRAMMES = '/admin/certificate-programmes';
const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

/** Admin (superadmin): templates, their logos and signatories, previews, programmes and issuing. */
export const adminCertificatesApi = {
  templates: async (): Promise<CertificateTemplate[]> => {
    const response = await apiClient.get<ApiResponse<unknown>>(TEMPLATES, { params: { per_page: 100 } });
    return listItems<CertificateTemplate>(response.data.data);
  },

  template: async (uuid: string): Promise<CertificateTemplate> => {
    const response = await apiClient.get<ApiResponse<CertificateTemplate>>(`${TEMPLATES}/${enc(uuid)}`);
    return response.data.data as CertificateTemplate;
  },

  createTemplate: async (payload: CertificateTemplatePayload): Promise<CertificateTemplate> => {
    const response = await apiClient.post<ApiResponse<CertificateTemplate>>(TEMPLATES, payload);
    return response.data.data as CertificateTemplate;
  },

  updateTemplate: async (uuid: string, payload: CertificateTemplatePayload): Promise<CertificateTemplate> => {
    const response = await apiClient.put<ApiResponse<CertificateTemplate>>(`${TEMPLATES}/${enc(uuid)}`, payload);
    return response.data.data as CertificateTemplate;
  },

  /** 422 while a programme uses it. */
  deleteTemplate: async (uuid: string): Promise<void> => {
    await apiClient.delete(`${TEMPLATES}/${enc(uuid)}`);
  },

  addLogo: async (templateUuid: string, file: File, label: string): Promise<CertificateTemplate> => {
    const form = new FormData();
    form.append('file', file);
    form.append('label', label);
    const response = await apiClient.post<ApiResponse<CertificateTemplate>>(`${TEMPLATES}/${enc(templateUuid)}/logos`, form, multipart);
    return response.data.data as CertificateTemplate;
  },

  updateLogo: async (templateUuid: string, logoUuid: string, input: { label: string; sort: number }): Promise<CertificateTemplate> => {
    const response = await apiClient.put<ApiResponse<CertificateTemplate>>(
      `${TEMPLATES}/${enc(templateUuid)}/logos/${enc(logoUuid)}`,
      input,
    );
    return response.data.data as CertificateTemplate;
  },

  deleteLogo: async (templateUuid: string, logoUuid: string): Promise<void> => {
    await apiClient.delete(`${TEMPLATES}/${enc(templateUuid)}/logos/${enc(logoUuid)}`);
  },

  addSignatory: async (
    templateUuid: string,
    input: { name: string; title: string; signature: File | null },
  ): Promise<CertificateTemplate> => {
    const form = new FormData();
    form.append('name', input.name);
    form.append('title', input.title);
    if (input.signature) form.append('signature', input.signature);
    const response = await apiClient.post<ApiResponse<CertificateTemplate>>(
      `${TEMPLATES}/${enc(templateUuid)}/signatories`,
      form,
      multipart,
    );
    return response.data.data as CertificateTemplate;
  },

  /**
   * Name, title and order; a new signature image when one is given, or
   * `removeSignature` to clear it. With a file, Laravel only reads multipart
   * bodies on POST, so the form is sent as POST with `_method=PUT`.
   */
  updateSignatory: async (
    templateUuid: string,
    sigUuid: string,
    input: { name: string; title: string; sort: number; signature?: File | null; removeSignature?: boolean },
  ): Promise<CertificateTemplate> => {
    const url = `${TEMPLATES}/${enc(templateUuid)}/signatories/${enc(sigUuid)}`;
    if (!input.signature) {
      const response = await apiClient.put<ApiResponse<CertificateTemplate>>(url, {
        name: input.name,
        title: input.title,
        sort: input.sort,
        ...(input.removeSignature ? { remove_signature: true } : {}),
      });
      return response.data.data as CertificateTemplate;
    }
    const form = new FormData();
    form.append('_method', 'PUT');
    form.append('name', input.name);
    form.append('title', input.title);
    form.append('sort', String(input.sort));
    form.append('signature', input.signature);
    const response = await apiClient.post<ApiResponse<CertificateTemplate>>(url, form, multipart);
    return response.data.data as CertificateTemplate;
  },

  /** Signature pictures are admin-only, so they are fetched with the session and shown from a blob. */
  signatureImage: async (signatureUrl: string): Promise<Blob> => {
    const response = await apiClient.get<Blob>(signatureUrl, { responseType: 'blob' });
    return response.data;
  },

  deleteSignatory: async (templateUuid: string, sigUuid: string): Promise<void> => {
    await apiClient.delete(`${TEMPLATES}/${enc(templateUuid)}/signatories/${enc(sigUuid)}`);
  },

  /** The saved design with unsaved edits drawn on top. Saves nothing. */
  preview: (templateUuid: string, overrides: CertificatePreviewPayload): Promise<ExportedFile> =>
    pdf(`${TEMPLATES}/${enc(templateUuid)}/preview`, 'certificate-preview.pdf', { method: 'post', body: overrides }),

  programmes: async (): Promise<CertificateProgramme[]> => {
    const response = await apiClient.get<ApiResponse<unknown>>(PROGRAMMES, { params: { per_page: 100 } });
    return listItems<CertificateProgramme>(response.data.data);
  },

  programme: async (uuid: string): Promise<CertificateProgramme> => {
    const response = await apiClient.get<ApiResponse<CertificateProgramme>>(`${PROGRAMMES}/${enc(uuid)}`);
    return response.data.data as CertificateProgramme;
  },

  createProgramme: async (payload: CertificateProgrammePayload): Promise<CertificateProgramme> => {
    const response = await apiClient.post<ApiResponse<CertificateProgramme>>(PROGRAMMES, payload);
    return response.data.data as CertificateProgramme;
  },

  updateProgramme: async (uuid: string, payload: CertificateProgrammePayload): Promise<CertificateProgramme> => {
    const response = await apiClient.put<ApiResponse<CertificateProgramme>>(`${PROGRAMMES}/${enc(uuid)}`, payload);
    return response.data.data as CertificateProgramme;
  },

  /** 422 once any certificate has been issued: switch it off instead. */
  deleteProgramme: async (uuid: string): Promise<void> => {
    await apiClient.delete(`${PROGRAMMES}/${enc(uuid)}`);
  },

  /** People who already hold one keep it; guests and nameless accounts are skipped. 422 when the programme is off. */
  issue: async (programmeUuid: string, payload: IssueCertificatesPayload): Promise<IssueCertificatesResult> => {
    const response = await apiClient.post<ApiResponse<IssueCertificatesResult>>(`${PROGRAMMES}/${enc(programmeUuid)}/issue`, payload);
    return readIssueResult(response.data.data);
  },

  /** Redraws every PDF the programme has issued, after a design change. Queued: 202 with `{queued}`. */
  rerender: async (programmeUuid: string): Promise<number> => {
    const response = await apiClient.post<ApiResponse<{ queued?: number }>>(`${PROGRAMMES}/${enc(programmeUuid)}/rerender`);
    return response.data.data?.queued ?? 0;
  },

  /** Links a channel quiz to a programme, or unlinks it with `null`. 422 for a programme that is off. */
  setQuizCertificate: async (quizUuid: string, programmeUuid: string | null): Promise<QuizCertificateLink> => {
    const response = await apiClient.put<ApiResponse<QuizCertificateLink>>(`/admin/channel-quizzes/${enc(quizUuid)}/certificate`, {
      programme_uuid: programmeUuid,
    });
    return response.data.data as QuizCertificateLink;
  },

  certificates: async (programmeUuid: string, page = 1): Promise<PageOf<IssuedCertificate>> => {
    const response = await apiClient.get<ApiResponse<unknown>>(`${PROGRAMMES}/${enc(programmeUuid)}/certificates`, {
      params: { page, per_page: 25 },
    });
    return pageOf<IssuedCertificate>(response.data);
  },
};
