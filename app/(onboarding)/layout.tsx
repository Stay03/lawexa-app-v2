'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Scroll to top on route change to ensure consistent positioning
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background">
      {/* Main content - no header, content starts from top */}
      <main>{children}</main>
    </div>
  );
}
