'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CertificateTemplateEditor } from '@/components/admin/certificates/CertificateTemplateEditor';
import { useCertificateTemplate } from '@/lib/hooks/useAdminCertificates';

/** `/admin/certificates/templates/{uuid}`, or `/new` for a new design. */
export default function AdminCertificateTemplatePage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = use(params);
  const isNew = uuid === 'new';
  const template = useCertificateTemplate(isNew ? null : uuid);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/certificates/templates">
          <ArrowLeft aria-hidden className="size-4" />
          Back to designs
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold tracking-tight">
        {isNew ? 'New certificate design' : (template.data?.name ?? 'Certificate design')}
      </h1>

      {isNew ? (
        <CertificateTemplateEditor template={null} />
      ) : template.isPending ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="aspect-[1.414/1] w-full" />
        </div>
      ) : template.isError ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border p-6">
          <p className="text-sm text-destructive">This design did not load. It may have been deleted.</p>
          <Button size="sm" variant="outline" onClick={() => void template.refetch()}>
            <RotateCw aria-hidden className="size-4" />
            Try again
          </Button>
        </div>
      ) : (
        <CertificateTemplateEditor key={template.data.uuid} template={template.data} />
      )}
    </div>
  );
}
