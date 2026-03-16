'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { StatuteImportUpload } from '@/components/admin/statutes/StatuteImportUpload';
import { StatuteImportProgress } from '@/components/admin/statutes/StatuteImportProgress';
import { StatuteImportHistoryTable } from '@/components/admin/statutes/StatuteImportHistoryTable';

import type { AdminStatuteImportsParams } from '@/types/admin-statutes';

/******************************************************************************
                                Main Page Component
******************************************************************************/

export default function StatuteImportPage() {
  const [activeImportUuids, setActiveImportUuids] = useState<string[]>([]);
  const [historyParams, setHistoryParams] = useState<AdminStatuteImportsParams>({
    page: 1,
    per_page: 10,
  });

  const handleImportStarted = useCallback((uuid: string) => {
    setActiveImportUuids((prev) => [uuid, ...prev]);
  }, []);

  const handleImportDone = useCallback((uuid: string) => {
    // Keep it visible but it will stop polling once completed/failed
    // The user can see the final state
  }, []);

  const handleHistoryPageChange = useCallback((page: number) => {
    setHistoryParams((prev) => ({ ...prev, page }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/statutes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Import Statute</h1>
      </div>

      {/* Upload Section */}
      <StatuteImportUpload onImportStarted={handleImportStarted} />

      {/* Active Imports */}
      {activeImportUuids.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Active Imports</h2>
          {activeImportUuids.map((uuid) => (
            <StatuteImportProgress
              key={uuid}
              uuid={uuid}
              onDone={() => handleImportDone(uuid)}
            />
          ))}
        </div>
      )}

      {/* Import History */}
      <StatuteImportHistoryTable
        params={historyParams}
        onPageChange={handleHistoryPageChange}
      />
    </div>
  );
}
