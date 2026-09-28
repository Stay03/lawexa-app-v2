'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { UserRole } from '@/types/auth';
import type { StatuteAnnotation } from '@/types/statute';
import { useV2Session } from '@/v2/runtime/session-context';
import { statutesQueries } from '../queries';

/**
 * Researchers' notes on the statute being read: who may see them, the notes
 * themselves, and the panel's open state, shared by the three places that
 * need them. The header's Notes button opens the panel; the document paints
 * the underlines and opens the panel from a tapped one; the panel lists the
 * notes and jumps the document to one.
 *
 * ── WHO SEES THEM ──────────────────────────────────────────────────────────
 * Researchers, admins and superadmins, read from the session on the first
 * frame (the quiz gate's pattern), so an ordinary reader's page never makes
 * the request and never paints a Notes button. This is the interface's gate,
 * not the guard: the server answers 403 to anyone below researcher.
 */

const NOTE_ROLES: ReadonlySet<UserRole> = new Set(['researcher', 'admin', 'superadmin']);

export function canSeeStatuteNotes(role: UserRole | null): boolean {
  return role !== null && NOTE_ROLES.has(role);
}

/** How the document offers itself to the panel: jump to a note's place and
 *  flash its words. Registered by the document once it has mounted. */
export type NoteJump = (annotation: StatuteAnnotation) => void;

interface StatuteNotesValue {
  readonly enabled: boolean;
  readonly notes: readonly StatuteAnnotation[];
  readonly status: 'idle' | 'pending' | 'error' | 'ready';
  readonly retry: () => void;
  readonly open: boolean;
  /** The notes the panel opened on (a tapped underline), or null for all. */
  readonly focus: readonly string[] | null;
  readonly openPanel: (focus?: readonly string[]) => void;
  readonly closePanel: () => void;
  readonly clearFocus: () => void;
  readonly registerJump: (jump: NoteJump | null) => void;
  readonly jumpTo: (annotation: StatuteAnnotation) => void;
}

const NO_NOTES: readonly StatuteAnnotation[] = [];

const StatuteNotesContext = createContext<StatuteNotesValue | null>(null);

export function StatuteNotesProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const { role } = useV2Session();
  const enabled = canSeeStatuteNotes(role);
  const query = useQuery({ ...statutesQueries.annotations(slug), enabled });

  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<readonly string[] | null>(null);
  const jumpRef = useRef<NoteJump | null>(null);

  const openPanel = useCallback((next?: readonly string[]) => {
    setFocus(next && next.length > 0 ? next : null);
    setOpen(true);
  }, []);
  const closePanel = useCallback(() => setOpen(false), []);
  const clearFocus = useCallback(() => setFocus(null), []);
  const registerJump = useCallback((jump: NoteJump | null) => {
    jumpRef.current = jump;
  }, []);
  const jumpTo = useCallback((annotation: StatuteAnnotation) => {
    setOpen(false);
    jumpRef.current?.(annotation);
  }, []);

  const { refetch } = query;
  const value = useMemo<StatuteNotesValue>(
    () => ({
      enabled,
      notes: query.data ?? NO_NOTES,
      status: !enabled ? 'idle' : query.isPending ? 'pending' : query.isError ? 'error' : 'ready',
      retry: () => void refetch(),
      open,
      focus,
      openPanel,
      closePanel,
      clearFocus,
      registerJump,
      jumpTo,
    }),
    [enabled, query.data, query.isPending, query.isError, refetch, open, focus, openPanel, closePanel, clearFocus, registerJump, jumpTo],
  );

  return <StatuteNotesContext.Provider value={value}>{children}</StatuteNotesContext.Provider>;
}

/** The notes for the statute on screen. Outside a provider (a surface that
 *  never shows notes) it answers "not enabled", so callers need no guard. */
export function useStatuteNotes(): StatuteNotesValue {
  return useContext(StatuteNotesContext) ?? DISABLED;
}

const DISABLED: StatuteNotesValue = {
  enabled: false,
  notes: NO_NOTES,
  status: 'idle',
  retry: () => {},
  open: false,
  focus: null,
  openPanel: () => {},
  closePanel: () => {},
  clearFocus: () => {},
  registerJump: () => {},
  jumpTo: () => {},
};
