'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { JurisdictionChoice } from '@/types/jurisdiction';

// sessionStorage key used by the home page (when no conversation exists yet).
// Bridged into a per-conversation key once the first send returns an id.
export const HOME_JURISDICTION_KEY = 'home_jurisdiction';

function storageKey(conversationId: string | null): string {
  return conversationId ? `conv_jurisdiction_${conversationId}` : HOME_JURISDICTION_KEY;
}

function readStored(conversationId: string | null): JurisdictionChoice {
  if (typeof window === 'undefined') return { mode: 'auto' };
  try {
    const raw = sessionStorage.getItem(storageKey(conversationId));
    if (!raw) return { mode: 'auto' };
    const parsed = JSON.parse(raw) as JurisdictionChoice;
    if (parsed && typeof parsed === 'object' && 'mode' in parsed) return parsed;
    return { mode: 'auto' };
  } catch {
    return { mode: 'auto' };
  }
}

// Per-conversation jurisdiction state, persisted to sessionStorage so the
// choice survives navigation (e.g. home → /c/[id]) within the same tab.
// Backend will own cross-reload persistence in v2.
export function useJurisdictionChoice(conversationId: string | null) {
  const [choice, setChoiceState] = useState<JurisdictionChoice>(() =>
    readStored(conversationId),
  );
  const lastIdRef = useRef<string | null>(conversationId);

  useEffect(() => {
    if (lastIdRef.current !== conversationId) {
      lastIdRef.current = conversationId;
      setChoiceState(readStored(conversationId));
    }
  }, [conversationId]);

  const setChoice = useCallback(
    (
      next:
        | JurisdictionChoice
        | ((prev: JurisdictionChoice) => JurisdictionChoice),
    ) => {
      setChoiceState((prev) => {
        const value = typeof next === 'function' ? next(prev) : next;
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(storageKey(conversationId), JSON.stringify(value));
          } catch {
            // sessionStorage may be unavailable (privacy mode); ignore.
          }
        }
        return value;
      });
    },
    [conversationId],
  );

  return [choice, setChoice] as const;
}

// Move the home-page choice into the conversation-scoped slot once the
// backend has created a conversation. Idempotent — safe to call repeatedly.
export function bridgeHomeJurisdictionToConversation(conversationId: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(HOME_JURISDICTION_KEY);
    if (!raw) return;
    const targetKey = storageKey(conversationId);
    if (!sessionStorage.getItem(targetKey)) {
      sessionStorage.setItem(targetKey, raw);
    }
    sessionStorage.removeItem(HOME_JURISDICTION_KEY);
  } catch {
    // ignore
  }
}
