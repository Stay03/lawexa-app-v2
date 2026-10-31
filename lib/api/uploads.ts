import { AxiosError, type AxiosResponse } from 'axios';

import { apiClient } from './client';
import {
  directUpload,
  mayFallBack,
  PartRejectedError,
  type DirectUploadOptions,
  type DirectUploadTransport,
  type PartUrl,
  type StartAnswer,
  type UploadStatus,
  type UploadTarget,
} from '@/lib/uploads/direct-upload';

/**
 * The live network for a direct upload (`lib/uploads/direct-upload.ts` has the
 * flow): the four `/uploads` calls through the API client, and each part PUT
 * by XMLHttpRequest straight to storage, the one browser request that reports
 * bytes sent. A part carries no auth and no Content-Type (Backend 527ce6a4,
 * (c)).
 */

interface Envelope<T> {
  data: T;
}

/** A refusal to show as today's upload shows it: the server answered no. */
function isRefusal(error: unknown): boolean {
  const status = error instanceof AxiosError ? error.response?.status : undefined;
  return status === 401 || status === 403 || status === 422;
}

/**
 * A refusal from the server's checks, as the 422 today's upload throws, so
 * `extractUploadLimit` and every caller's toast read it unchanged.
 */
function refusalError(refusal: Record<string, unknown>): Error {
  const message = typeof refusal.message === 'string' ? refusal.message : 'The file could not be added.';
  const response = { status: 422, statusText: 'Unprocessable Content', data: refusal, headers: {}, config: {} } as AxiosResponse;
  return new AxiosError(message, AxiosError.ERR_BAD_REQUEST, undefined, undefined, response);
}

function putPart(url: string, body: Blob, onSent: (bytes: number) => void, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    request.open('PUT', url);
    request.upload.onprogress = (event) => onSent(event.loaded);
    request.onload = () => {
      signal.removeEventListener('abort', abort);
      if (request.status >= 200 && request.status < 300) {
        // Storage's CORS rule exposes ETag (Backend sends the rule with the build).
        const etag = request.getResponseHeader('ETag');
        if (etag) resolve(etag);
        else reject(new Error('Storage did not expose the part’s ETag.'));
      } else {
        reject(new PartRejectedError(request.status));
      }
    };
    request.onerror = () => {
      signal.removeEventListener('abort', abort);
      reject(new Error('The part could not reach storage.'));
    };
    request.onabort = () => {
      signal.removeEventListener('abort', abort);
      const error = new Error('The upload was cancelled.');
      error.name = 'AbortError';
      reject(error);
    };
    signal.addEventListener('abort', abort, { once: true });
    request.send(body);
  });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop);
      resolve();
    }, ms);
    const stop = () => {
      clearTimeout(timer);
      const error = new Error('The upload was cancelled.');
      error.name = 'AbortError';
      reject(error);
    };
    signal.addEventListener('abort', stop, { once: true });
  });
}

function liveTransport<F>(): DirectUploadTransport<F> {
  return {
    start: async (body) => (await apiClient.post<Envelope<StartAnswer>>('/uploads', body)).data.data,
    partUrls: async (uuid, numbers) =>
      (await apiClient.post<Envelope<{ parts: PartUrl[] }>>(`/uploads/${uuid}/parts`, { numbers })).data.data.parts,
    complete: async (uuid, parts) =>
      (await apiClient.post<Envelope<UploadStatus<F>>>(`/uploads/${uuid}/complete`, { parts })).data.data,
    status: async (uuid) => (await apiClient.get<Envelope<UploadStatus<F>>>(`/uploads/${uuid}`)).data.data,
    cancel: async (uuid) => {
      await apiClient.delete(`/uploads/${uuid}`);
    },
    putPart,
    sleep,
    isRefusal,
    refusalError,
  };
}

/**
 * Upload one file by the direct path, and by today's upload (`legacy`) when
 * the direct path cannot run and the file is small enough for it. Resolves
 * with `{ data: file }`, the part of the legacy answer every caller reads, so
 * a caller swaps its upload call for this one and changes nothing else.
 */
export async function uploadFile<F>(
  file: File,
  target: UploadTarget,
  legacy: (options: DirectUploadOptions) => Promise<{ data: F }>,
  options: DirectUploadOptions = {},
): Promise<{ data: F }> {
  try {
    return { data: await directUpload<F>(file, target, liveTransport<F>(), options) };
  } catch (error) {
    if (mayFallBack(error, file.size)) return legacy(options);
    throw error;
  }
}
