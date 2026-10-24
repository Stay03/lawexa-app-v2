import type { ReactNode } from 'react';

import { HomeFrame } from '@/v2/shell/designs/HomeFrame';

/**
 * The home's three tabs, `/`, `/work` and `/study`, under one layout, so the
 * chat box they share stays mounted while the reader switches between them
 * (Stay, 24 October 2026). `HomeFrame` carries the full note. The route group
 * leaves the addresses as they were.
 */
export default function HomeLayout({ children }: { children: ReactNode }) {
  return <HomeFrame>{children}</HomeFrame>;
}
