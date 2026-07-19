/**
 * The AppShell content region's DOM id — `.v2-shell__content`, the ONE scroll
 * container in the v2 shell. A shared constant (no 'use client', no
 * 'server-only') so the server-rendered AppShell can stamp it and client hooks
 * can resolve the element without duplicating a magic string.
 */
export const V2_SHELL_CONTENT_ID = 'v2-shell-content';
