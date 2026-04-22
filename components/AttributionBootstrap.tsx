'use client';

import { useEffect } from 'react';
import { captureAttribution } from '@/lib/utils/attribution';

export function AttributionBootstrap() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
