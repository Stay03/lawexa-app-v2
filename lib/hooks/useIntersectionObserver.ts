'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  freezeOnceVisible?: boolean;
}

/**
 * Hook for detecting when an element enters the viewport
 * Useful for implementing infinite scroll
 */
export function useIntersectionObserver(options?: UseIntersectionObserverOptions) {
  const { freezeOnceVisible = false, ...observerOptions } = options || {};
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const frozen = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // If frozen, don't observe anymore
    if (frozen.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isElementIntersecting = entry.isIntersecting;
        setIsIntersecting(isElementIntersecting);

        // Freeze if needed
        if (freezeOnceVisible && isElementIntersecting) {
          frozen.current = true;
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '100px', ...observerOptions }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [freezeOnceVisible, observerOptions]);

  // Reset function if needed
  const reset = useCallback(() => {
    frozen.current = false;
    setIsIntersecting(false);
  }, []);

  return { ref, isIntersecting, reset };
}
