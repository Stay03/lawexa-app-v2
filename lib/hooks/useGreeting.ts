'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getSmartGreeting, getSmartGreetingParts } from '@/lib/constants/greetings';

/**
 * Hook that returns a full greeting string.
 * Uses smart greeting system with holiday, time, and day-based priorities.
 */
export function useGreeting() {
  const { user } = useAuthStore();
  const [greeting, setGreeting] = useState<string>('Welcome!');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setGreeting(getSmartGreeting(user?.name));
  }, [user?.name]);

  // Return a static greeting during SSR to avoid hydration mismatch
  if (!mounted) {
    return 'Welcome!';
  }

  return greeting;
}

/**
 * Hook that returns greeting parts separately for custom styling.
 * Returns { greeting: string, name: string }
 * Uses smart greeting system with holiday, time, and day-based priorities.
 */
export function useGreetingParts() {
  const { user } = useAuthStore();
  const [parts, setParts] = useState<{ greeting: string; name: string }>({
    greeting: 'Welcome',
    name: '',
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setParts(getSmartGreetingParts(user?.name));
  }, [user?.name]);

  // Return static values during SSR to avoid hydration mismatch
  if (!mounted) {
    return { greeting: 'Welcome', name: '' };
  }

  return parts;
}
