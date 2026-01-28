'use client';

import { PageContainer } from '@/components/layout';
import { SettingsSidebarNav } from '@/components/settings/settings-sidebar-nav';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer variant="list" className="max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <SettingsSidebarNav />
        <div className="flex-1 min-w-0 space-y-6">{children}</div>
      </div>
    </PageContainer>
  );
}
