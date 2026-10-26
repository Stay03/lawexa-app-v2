/**
 * What Home's box says when a new chat could not start, and what the app
 * reports about it (techlead, 26 October 2026). Lucy sent a first question
 * with a file from Home and read "Network error. Please try again." with no
 * chat made and nothing in the server's logs: the browser got no answer at
 * all, and Home reported nothing, as only the chat screen did
 * (`send_network` in the chat engine).
 *
 *  - No answer at all (offline, a dropped link, a timeout): the server never
 *    saw it, so the app reports it as `send_network`, and the box says so in
 *    words that tell the reader nothing they typed or attached is lost. Trying
 *    again is safe: the retry carries the same `client_request_id`, so a send
 *    the server did take opens its chat instead of starting a second one.
 *  - An answer with a status: the API's own message. In a space, a Viewer's
 *    403 and a 422 keep the space's words (`startChatRefusal`).
 *
 * Pure, so the test can run it; `HomeComposer` shows the message and sends
 * the report.
 */

import { AxiosError } from 'axios';

import type { ChatErrorReport } from '@/v2/runtime/chat-errors/report';
import { startChatRefusal } from '@/v2/features/spaces/content-model';

export interface HomeSendFailure {
  message: string;
  /** Set only when the server never answered; it records its own failures. */
  report: ChatErrorReport | null;
}

/** The box's words when the send got no answer, by what the box still holds. */
export function unreachedMessage(attachments: number): string {
  const kept =
    attachments === 0
      ? 'Your message is still here.'
      : attachments === 1
        ? 'Your message and file are still here.'
        : 'Your message and files are still here.';
  return `Couldn’t reach Lawexa. ${kept} Try again.`;
}

export function homeSendFailure(
  error: AxiosError,
  context: { attachments: number; inSpace: boolean },
): HomeSendFailure {
  const response = error.response;
  if (!response) {
    return {
      message: unreachedMessage(context.attachments),
      report: {
        code: 'send_network',
        message: `A new chat from Home got no answer from the server (${error.code ?? 'no code'}).`,
        conversationId: null,
      },
    };
  }

  const status = response.status;
  const serverMessage = messageOf(response.data);
  if (context.inSpace && (status === 403 || status === 422)) {
    return { message: startChatRefusal(status, serverMessage), report: null };
  }
  return {
    message: serverMessage ?? `Lawexa couldn’t start the chat (error ${status}). Try again.`,
    report: null,
  };
}

/** The API envelope's `message`, when the answer is one (a proxy's HTML page is not). */
function messageOf(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const message = (data as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message.trim() : null;
}
