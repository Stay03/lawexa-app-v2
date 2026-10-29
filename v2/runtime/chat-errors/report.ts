/**
 * Chat errors the app shows, reported to the server (Stay, 20 October 2026:
 * there was no way to know when people hit chat errors). The server records
 * what it sees itself: a refused send, a failed answer, a tool that failed. This
 * covers what only the app sees: a send that never reached the server, a live
 * answer whose stream went quiet, a picture that did not load, and the chat
 * screen crashing.
 *
 * WHAT A REPORT HOLDS. A code and a short message the app writes itself, never
 * text the person typed or read. POST /api/chat-errors caps the message at 300
 * characters and links the chat only when it is the sender's own.
 *
 * HOW OFTEN. The same code for the same chat goes once a minute at most, and
 * no more than ten reports a minute in all (the server takes thirty). A report
 * that cannot be sent because the network is down waits, up to five of them,
 * and goes when the browser is back online. Nothing here ever throws or shows.
 */

import { AxiosError } from 'axios';

import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/stores/authStore';

export type ChatErrorCode =
  /** A send that got no answer at all from the server (offline, DNS, a dropped link). */
  | 'send_network'
  /** A live answer's stream stopped carrying it; the app followed the turn by its status. */
  | 'stream_stall'
  /** A picture in a chat message did not load. */
  | 'picture_load_failed'
  /** The chat screen crashed and showed its error state. */
  | 'chat_view_crash';

export interface ChatErrorReport {
  code: ChatErrorCode;
  /** Written by the app, never the person's text. Cut to 300 characters. */
  message?: string;
  httpStatus?: number;
  /** The chat's id, as in its address. */
  conversationId?: string | null;
}

export interface ChatErrorPayload {
  code: ChatErrorCode;
  message?: string;
  http_status?: number;
  conversation_id?: string;
  platform: string;
  app_version?: string;
}

const MESSAGE_MAX = 300;
const SAME_KEY_MS = 60_000;
const PER_MINUTE = 10;
const WAITING_MAX = 5;

/** The request body for one report. */
export function chatErrorPayload(
  report: ChatErrorReport,
  context: { userAgent: string; appVersion: string | null },
): ChatErrorPayload {
  const payload: ChatErrorPayload = { code: report.code, platform: platformOf(context.userAgent) };
  const message = report.message?.trim();
  if (message) payload.message = message.slice(0, MESSAGE_MAX);
  if (report.httpStatus !== undefined && report.httpStatus >= 0 && report.httpStatus <= 599) {
    payload.http_status = report.httpStatus;
  }
  if (report.conversationId) payload.conversation_id = report.conversationId.slice(0, 64);
  if (context.appVersion) payload.app_version = context.appVersion.slice(0, 12);
  return payload;
}

/** The kind of device, from the browser's user agent. */
export function platformOf(userAgent: string): string {
  if (/Android/i.test(userAgent)) return 'android-web';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios-web';
  return 'web';
}

/**
 * Decides whether a report goes now: once a minute per code and chat, and ten
 * a minute in all. Pure apart from the clock it is given.
 */
export function createReportGate() {
  const lastByKey = new Map<string, number>();
  let sent: number[] = [];
  return (report: ChatErrorReport, now: number): boolean => {
    const key = `${report.code}:${report.conversationId ?? ''}`;
    const last = lastByKey.get(key);
    if (last !== undefined && now - last < SAME_KEY_MS) return false;
    sent = sent.filter((at) => now - at < 60_000);
    if (sent.length >= PER_MINUTE) return false;
    lastByKey.set(key, now);
    sent.push(now);
    return true;
  };
}

const allow = createReportGate();
const waiting: ChatErrorPayload[] = [];
let listening = false;

async function post(payload: ChatErrorPayload): Promise<void> {
  try {
    await apiClient.post('/chat-errors', payload);
  } catch (error) {
    // No answer at all: the network is down, so it waits for the browser to be
    // back online. Any answer (a 401, a 422, a 429) is final and dropped.
    if (error instanceof AxiosError && !error.response && waiting.length < WAITING_MAX) {
      waiting.push(payload);
      listenForOnline();
    }
  }
}

function listenForOnline(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener(
    'online',
    () => {
      listening = false;
      for (const payload of waiting.splice(0)) void post(payload);
    },
    { once: true },
  );
}

/** Reports one chat error. Fire and forget: it never throws and never shows. */
export function reportChatError(report: ChatErrorReport): void {
  void sendChatError(report);
}

/**
 * The same report, as a promise that settles when the request has (it never
 * rejects): for a caller that must not leave the page before it is sent, the
 * error screen's one reload for a missing chunk (`app/v2/error.tsx`).
 */
export function sendChatError(report: ChatErrorReport): Promise<void> {
  try {
    if (typeof window === 'undefined' || !useAuthStore.getState().token) return Promise.resolve();
    if (!allow(report, Date.now())) return Promise.resolve();
    const payload = chatErrorPayload(report, {
      userAgent: navigator.userAgent,
      appVersion: document.documentElement.getAttribute('data-dpl-id'),
    });
    return post(payload);
  } catch {
    // A report must never break the screen that made it.
    return Promise.resolve();
  }
}
