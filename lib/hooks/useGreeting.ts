'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getTimeBasedGreeting } from '@/lib/constants/greetings';

export function useGreeting() {
  const { user } = useAuthStore();
  const [greeting, setGreeting] = useState<string>('Welcome!');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setGreeting(getTimeBasedGreeting(user?.name));
  }, [user?.name]);

  // Return a static greeting during SSR to avoid hydration mismatch
  if (!mounted) {
    return 'Welcome!';
  }

  return greeting;
}
