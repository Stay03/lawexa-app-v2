/**
 * A guest's refused action (server guest-locks, 27 November 2026): creating an
 * organisation, inviting, creating or publishing a note, publishing a chat,
 * and every upload answer
 *
 *   403 { success: false, code: "account_required", action, message }
 *
 * The API client hands each one here, and the v2 shell's one dialog shows it
 * as a sign-up prompt, so no screen needs its own handling. Keyed on `code`,
 * never on the status alone: a 403 means many other things.
 */

/** What the guest tried to do; the server's word for it. */
export type AccountRequiredAction = 'organization' | 'invite' | 'note' | 'publish' | 'upload';

export interface AccountRequired {
  action: string;
  /** The server's sentence, "Create a free account to …". */
  message: string;
}

/** The refusal in an API error, or null when the error is anything else. */
export function accountRequiredOf(error: unknown): AccountRequired | null {
  if (typeof error !== 'object' || error === null) return null;
  const data = (error as { response?: { data?: unknown } }).response?.data;
  if (typeof data !== 'object' || data === null) return null;
  const body = data as { code?: unknown; action?: unknown; message?: unknown };
  if (body.code !== 'account_required') return null;
  return {
    action: typeof body.action === 'string' ? body.action : '',
    message:
      typeof body.message === 'string' && body.message.trim()
        ? body.message
        : 'Create a free account to do this.',
  };
}

let current: AccountRequired | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Opens the prompt (the API client calls this). */
export function showAccountRequired(refusal: AccountRequired): void {
  current = refusal;
  emit();
}

export function dismissAccountRequired(): void {
  if (current === null) return;
  current = null;
  emit();
}

export function subscribeAccountRequired(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function accountRequiredSnapshot(): AccountRequired | null {
  return current;
}
