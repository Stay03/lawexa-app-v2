'use client';

import { useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Scale, BookOpen } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  CaseCard,
  CaseSearchBar,
  CasePagination,
  CaseListSkeleton,
} from '@/components/cases';
import { PageContainer, PageHeader } from '@/components/layout';
import { useCases } from '@/lib/hooks/useCases';

/**
 * Case Library list page
 */
function CasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read URL state
  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';

  // Fetch cases
  const { data, isLoading, isError, refetch } = useCases({
    page,
    search: search || undefined,
    per_page: 15,
  });

  // Update URL params
  const updateParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });
      const queryString = params.toString();
      router.push(queryString ? `/cases?${queryString}` : '/cases');
    },
    [router, searchParams]
  );

  // Handle search change
  const handleSearchChange = useCallback(
    (value: string) => {
      updateParams({ search: value || null, page: null });
    },
    [updateParams]
  );

  // Handle page change
  const handlePageChange = useCallback(
    (newPage: number) => {
      updateParams({ page: newPage > 1 ? newPage : null });
    },
    [updateParams]
  );

  // Render case list content
  const renderContent = () => {
    if (isLoading) {
      return <CaseListSkeleton />;
    }

    if (isError) {
      return (
        <ErrorState
          title="Failed to load cases"
          description="We couldn't load the case library. Please try again."
          retry={() => refetch()}
        />
      );
    }

    if (!data?.data || data.data.length === 0) {
      return (
        <EmptyState
          icon={Scale}
          title={search ? 'No cases found' : 'No cases yet'}
          description={
            search
              ? `No cases match "${search}". Try a different search term.`
              : 'Cases will appear here once added to the library.'
          }
          action={
            search
              ? { label: 'Clear search', onClick: () => handleSearchChange('') }
              : undefined
          }
        />
      );
    }

    return (
      <div className="space-y-3">
        {data.data.map((caseItem) => (
          <CaseCard key={caseItem.id} caseItem={caseItem} />
        ))}

        {data.pagination.last_page > 1 && (
          <CasePagination
            currentPage={data.pagination.current_page}
            lastPage={data.pagination.last_page}
            total={data.pagination.total}
            onPageChange={handlePageChange}
            className="mt-6"
          />
        )}
      </div>
    );
  };

  return (
    <PageContainer variant="list">
      <PageHeader
        title="Case Library"
        description="Browse and search legal cases from our comprehensive database."
      />

      {/* Search bar */}
      <CaseSearchBar
        value={search}
        onChange={handleSearchChange}
        placeholder="Search cases by title..."
        className="max-w-md"
      />

      {/* Tabs */}
      <Tabs defaultValue="recent" className="w-full">
        <TabsList>
          <TabsTrigger value="recent">
            <BookOpen className="mr-1.5 h-4 w-4" />
            Recent Cases
          </TabsTrigger>
          <TabsTrigger value="trending" disabled>
            Trending
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="mt-4">
          {renderContent()}
        </TabsContent>

        <TabsContent value="trending" className="mt-4">
          <EmptyState
            icon={Scale}
            title="Coming soon"
            description="Trending cases will be available in a future update."
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

export default CasesPage;
