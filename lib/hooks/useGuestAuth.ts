'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useFingerprint } from '@/lib/hooks/useFingerprint';
import { authApi } from '@/lib/api/auth';

/******************************************************************************
                               Types
******************************************************************************/

interface IGuestAuthResult {
  isReady: boolean;
  isLoading: boolean;
  isGuest: boolean;
  error: string | null;
}

/******************************************************************************
                               Constants
******************************************************************************/

// Module-level promise to deduplicate concurrent guest token acquisitions
// (e.g. when multiple components mount simultaneously and all call useGuestAuth)
let guestTokenPromise: Promise<void> | null = null;

/******************************************************************************
                               Functions
******************************************************************************/

/**
 * Acquires a guest token if the user is not already authenticated.
 * Returns { isReady, isLoading, isGuest, error } so consuming components
 * know when to proceed with API calls that require a Bearer token.
 */
function useGuestAuth(): IGuestAuthResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);
  const setAuth = useAuthStore((s) => s.setAuth);
  const { fingerprint, isLoading: isFingerprintLoading } = useFingerprint();
  const [isAcquiring, setIsAcquiring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const acquiredRef = useRef(false);

  useEffect(() => {
    // Already authenticated (real user or existing guest) — nothing to do
    if (isAuthenticated) return;
    // Still loading fingerprint
    if (isFingerprintLoading) return;
    // Prevent double acquisition in React strict mode
    if (acquiredRef.current) return;
    acquiredRef.current = true;
    setIsAcquiring(true);
    // Deduplicate: if another component already started acquiring, reuse its promise
    if (!guestTokenPromise) {
      guestTokenPromise = authApi
        .guestToken(fingerprint ?? undefined)
        .then((response) => {
          if (response.success && response.data) {
            useAuthStore.getState().setAuth(response.data.user, response.data.token);
          } else {
            throw new Error('Guest token response unsuccessful');
          }
        })
        .finally(() => {
          guestTokenPromise = null;
        });
    }
    guestTokenPromise
      .catch(() => {
        setError('Failed to acquire guest access. Please refresh the page.');
      })
      .finally(() => {
        setIsAcquiring(false);
      });
  }, [isAuthenticated, isFingerprintLoading, fingerprint, setAuth]);

  return {
    isReady: isAuthenticated,
    isLoading: isFingerprintLoading || isAcquiring,
    isGuest,
    error,
  };
}

/******************************************************************************
                               Export default
******************************************************************************/

export { useGuestAuth };
