'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  // Redirect unverified email users to check-email page
  useEffect(() => {
    if (isAuthenticated && user?.auth_provider === 'email' && !user?.is_verified) {
      router.replace(`/check-email?email=${encodeURIComponent(user.email || '')}`);
    }
  }, [isAuthenticated, user, router]);

  // Scroll to top on route change to ensure consistent positioning
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Show nothing while redirecting unverified users
  if (isAuthenticated && user?.auth_provider === 'email' && !user?.is_verified) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main content - no header, content starts from top */}
      <main>{children}</main>
    </div>
  );
}
