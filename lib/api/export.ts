import { apiClient } from './client';

/**
 * Word export of one fenced block of a saved AI answer (backend contract,
 * 7 October 2026):
 * `POST /api/conversations/{conversation uuid}/messages/{message id}/export-docx`
 * with `{ "block": n }`. The server reads the block from the saved message, so
 * the browser sends no text. `n` counts every fenced block in the message from
 * 0, code fences included. Signed in only; 20 a minute per user.
 */
export interface ExportedFile {
  blob: Blob;
  filename: string;
}

export const DOCX_FALLBACK_NAME = 'lawexa-document.docx';

/** The file name in a `Content-Disposition` header, or the fallback. */
export function filenameFromDisposition(disposition: unknown, fallback = DOCX_FALLBACK_NAME): string {
  if (typeof disposition !== 'string') return fallback;
  const star = disposition.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, '')) || fallback;
    } catch {
      // A malformed encoded name: use the plain one below.
    }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  return plain?.[1].trim() || fallback;
}

/**
 * Word or PDF of a draft as it stands in the draft panel, before it is a note
 * (Stay, 24 October 2026: "That save as note should be a drop-down of 'save
 * note, download docx, download pdf'"). Backend contract:
 * `POST /api/export/document` with `{ title, html, format }`; the answer is
 * the file. Signed in; no note is made.
 */
export type DocumentExportFormat = 'docx' | 'pdf';

/** The name a draft's file takes when the server sends none. */
export function documentFallbackName(format: DocumentExportFormat): string {
  return `lawexa-draft.${format}`;
}

export const exportApi = {
  document: async (input: { title: string; html: string; format: DocumentExportFormat }): Promise<ExportedFile> => {
    const response = await apiClient.post<Blob>(
      '/export/document',
      { title: input.title, html: input.html, format: input.format },
      { responseType: 'blob' },
    );
    return {
      blob: response.data,
      filename: filenameFromDisposition(response.headers['content-disposition'], documentFallbackName(input.format)),
    };
  },

  messageBlockDocx: async (input: {
    conversationId: string;
    messageId: number;
    block: number;
  }): Promise<ExportedFile> => {
    const response = await apiClient.post<Blob>(
      `/conversations/${encodeURIComponent(input.conversationId)}/messages/${input.messageId}/export-docx`,
      { block: input.block },
      { responseType: 'blob' },
    );
    return { blob: response.data, filename: filenameFromDisposition(response.headers['content-disposition']) };
  },
};
