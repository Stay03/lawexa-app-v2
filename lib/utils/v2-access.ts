import type { UserRole } from '@/types/auth';

/**
 * Roles allowed to see and use the v2 interface preview. Opened from the
 * privileged-only dark launch to EVERY registered account by the owner on
 * August 3, 2026 — v2 stays opt-in (the Developer toggle sets the cookie;
 * nothing is forced), but the choice now belongs to every real user. Guests
 * and bots stay outside: a guest is a view-only pre-registration identity,
 * not someone choosing an interface.
 *
 * Widening (or dropping) this list remains a one-line change. The `satisfies`
 * clause guarantees every entry is a real role, so a typo fails the build.
 */
export const V2_PREVIEW_ROLES = [
  'user',
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

/**
 * Roles that see the NEW design's Settings › Developer, the screen whose "New
 * Lawexa (v2)" switch is the one way back to the classic design (owner, 28
 * October 2026, Moving to v2 UI, B: "Staff only. Users stay on the new
 * design"). Staff are the roles the app already treats as Lawexa's own
 * people (`SPACES_ROLES`, and the v2 preview before it opened on 3 August):
 * researchers, admins and superadmins. An ordinary account, free or paid,
 * sees no Developer row and cannot open the screen.
 *
 * The classic design's own Developer page still uses `canAccessV2Preview`:
 * there it is the switch INTO the new design, which every account keeps.
 */
export const DEVELOPER_SETTINGS_ROLES = [
  'researcher',
  'admin',
  'superadmin',
] as const satisfies readonly UserRole[];

export function canUseDeveloperSettings(role: UserRole | null | undefined): boolean {
  return !!role && (DEVELOPER_SETTINGS_ROLES as readonly UserRole[]).includes(role);
}
