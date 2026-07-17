'use client';

import { useAuthStore } from '@/lib/stores/authStore';
import { canAccessV2Preview } from '@/lib/utils/v2-access';
import { DeveloperSettings } from '@/components/settings/DeveloperSettings';

export default function DeveloperSettingsPage() {
  const role = useAuthStore((s) => s.user?.role);

  // The nav link is already role-filtered; this is a quiet fallback for anyone
  // who reaches the URL directly. Not a security boundary — the cookie exposes
  // nothing, so no redirect is needed.
  if (!canAccessV2Preview(role)) {
    return (
      <p className="text-sm text-muted-foreground">
        Developer tools aren&apos;t available for your account.
      </p>
    );
  }

  return <DeveloperSettings />;
}
