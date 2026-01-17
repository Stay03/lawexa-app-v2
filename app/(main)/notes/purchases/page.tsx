'use client';

import { ShoppingBag, Clock } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/layout';
import { NotesNavTabs } from '@/components/notes';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

/**
 * My Purchases placeholder page - Coming Soon
 */
function MyPurchasesPage() {
  return (
    <PageContainer variant="list">
      <PageHeader
        title="My Purchases"
        description="Access your purchased notes."
      />

      {/* Main navigation tabs */}
      <NotesNavTabs activeTab="purchases" />

      {/* Full-width search bar */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search purchased notes..."
          disabled
          className="w-full pl-10"
        />
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Coming Soon State */}
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">Coming Soon</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            The ability to purchase and access notes will be available soon.
            Stay tuned for updates!
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Feature in development</span>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default MyPurchasesPage;
