import type { UserRole } from '@/types/auth';

/**
 * When Wrapped 2026 is open to everyone (Backend e5d5c35e, 21 November 2026):
 * GET /api/wrapped/2026/window, public, cached 5 minutes. The dates are admin
 * settings (seeded 1 to 31 December, Lagos time) that also gate
 * /wrapped/2026/me, so moving the launch is a setting change, never a push.
 * The app never holds a launch date of its own.
 */
export interface Wrapped26Window {
  starts_at: string;
  ends_at: string;
  open: boolean;
}

export const WRAPPED26_WINDOW_PATH = '/wrapped/2026/window';

/** The 2026 cache keys, apart from the Bar Finals ones, shared by /wrapped and the v2 home. */
export const wrapped2026Keys = {
  all: ['wrapped', '2026', 'me'] as const,
  me: (userId: string | number | null) => ['wrapped', '2026', 'me', { userId }] as const,
  window: ['wrapped', '2026', 'window'] as const,
};

/** The window is read at most every five minutes, as the server caches it. */
export const WRAPPED26_WINDOW_STALE_MS = 5 * 60 * 1000;

/** Staff see their record as soon as the batch has run, before the window opens (Backend). */
export const WRAPPED26_EARLY_ROLES = ['researcher', 'admin', 'superadmin'] as const satisfies readonly UserRole[];

export function seesWrapped26Early(role: UserRole | null | undefined): boolean {
  return !!role && (WRAPPED26_EARLY_ROLES as readonly UserRole[]).includes(role);
}

/**
 * Whether the home asks for a 2026 record: signed in, not hidden, and the
 * window open, or a staff account. Everyone else sends no request until
 * launch. Pure, so a test pins it.
 */
export function wrapped26Askable(state: { signedIn: boolean; hidden: boolean; open: boolean; role: UserRole | null | undefined }): boolean {
  return state.signedIn && !state.hidden && (state.open || seesWrapped26Early(state.role));
}

/** The window from the server, or null when the API cannot say (the page then keeps the Bar Finals words). */
export async function fetchWrapped26Window(): Promise<Wrapped26Window | null> {
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
  try {
    const response = await fetch(`${base}/api${WRAPPED26_WINDOW_PATH}`, { headers: { Accept: 'application/json' }, next: { revalidate: 300 } });
    if (!response.ok) return null;
    const body = (await response.json()) as Partial<Wrapped26Window> & { data?: Partial<Wrapped26Window> };
    const window = body.data ?? body;
    return typeof window.open === 'boolean' && window.starts_at && window.ends_at ? { starts_at: window.starts_at, ends_at: window.ends_at, open: window.open } : null;
  } catch {
    return null;
  }
}
