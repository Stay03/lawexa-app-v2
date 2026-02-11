'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CaseForm } from '@/components/admin/cases/CaseForm';

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Case creation page
 * Full-page form for creating a new case
 */
export default function CreateCasePage() {
  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/admin/cases">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Cases
        </Button>
      </Link>

      {/* Form */}
      <CaseForm mode="create" />
    </div>
  );
}
