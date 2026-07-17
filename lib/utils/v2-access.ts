import type { UserRole } from '@/types/auth';

/**
 * Roles allowed to see and use the v2 interface preview during the frontend
 * overhaul's dark launch. Everyone else gets no Developer nav link and a quiet
 * "not available" state on the route — mirrors the Spaces gating in
 * `spaces-access.ts`.
 *
 * Opening the preview to more testers later is a one-line change: widen (or
 * drop) this list. The `satisfies` clause guarantees every entry is a real
 * role, so a typo fails the build.
 */
export const V2_PREVIEW_ROLES = [
  'researcher',
  'admin',
  'superadmin',
] as const satisfies readonly UserRole[];

/**
 * Whether the given role may access the v2 preview toggle. Returns `false` for a
 * missing role (logged out, guest, or not yet loaded).
 */
export function canAccessV2Preview(role: UserRole | null | undefined): boolean {
  return !!role && (V2_PREVIEW_ROLES as readonly UserRole[]).includes(role);
}
