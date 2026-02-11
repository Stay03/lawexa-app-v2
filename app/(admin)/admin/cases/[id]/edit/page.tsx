'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CaseForm } from '@/components/admin/cases/CaseForm';

/******************************************************************************
                                Component Props
******************************************************************************/

interface EditCasePageProps {
  params: Promise<{ id: string }>;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Case edit page
 * Full-page form for editing an existing case
 */
export default function EditCasePage({ params }: EditCasePageProps) {
  const { id } = use(params);
  const slug = id; // The URL parameter is actually a slug

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href={`/admin/cases/${slug}`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Case
        </Button>
      </Link>

      {/* Form */}
      <CaseForm caseSlug={slug} mode="edit" />
    </div>
  );
}
