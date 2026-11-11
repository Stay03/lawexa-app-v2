'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgrammeCertificates } from '@/components/admin/certificates/ProgrammeCertificates';
import { ProgrammeForm } from '@/components/admin/certificates/ProgrammeForm';
import { useCertificateProgramme } from '@/lib/hooks/useAdminCertificates';

/** `/admin/certificates/programmes/{uuid}`, or `/new`: details, issuing by hand, and what was issued. */
export default function AdminCertificateProgrammePage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = use(params);
  const isNew = uuid === 'new';
  const programme = useCertificateProgramme(isNew ? null : uuid);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/certificates/programmes">
          <ArrowLeft aria-hidden className="size-4" />
          Back to programmes
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold tracking-tight">
        {isNew ? 'New programme' : (programme.data?.name ?? 'Programme')}
      </h1>

      {isNew ? (
        <ProgrammeForm programme={null} />
      ) : programme.isPending ? (
        <Skeleton className="h-80 w-full max-w-2xl" />
      ) : programme.isError ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border p-6">
          <p className="text-sm text-destructive">This programme did not load. It may have been deleted.</p>
          <Button size="sm" variant="outline" onClick={() => void programme.refetch()}>
            <RotateCw aria-hidden className="size-4" />
            Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-10">
          <ProgrammeForm key={`${programme.data.uuid}-${programme.data.is_active}`} programme={programme.data} />
          <ProgrammeCertificates programme={programme.data} />
        </div>
      )}
    </div>
  );
}
