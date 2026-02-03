'use client';

import { PageContainer } from '@/components/layout';
import { AdminSidebarNav } from '@/components/admin/admin-sidebar-nav';
import { AdminGuard } from '@/components/auth/AdminGuard';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <PageContainer variant="list" className="max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="text-muted-foreground">
            Manage conversations and monitor platform activity
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <AdminSidebarNav />
          <div className="flex-1 min-w-0 space-y-6">{children}</div>
        </div>
      </PageContainer>
    </AdminGuard>
  );
}
