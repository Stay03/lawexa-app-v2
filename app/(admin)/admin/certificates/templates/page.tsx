'use client';

import Link from 'next/link';
import { Award, Plus, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CertificatesTabs } from '@/components/admin/certificates/CertificatesTabs';
import { SuperadminGate } from '@/components/admin/certificates/SuperadminGate';
import { useCertificateTemplates } from '@/lib/hooks/useAdminCertificates';

/** `/admin/certificates/templates`: every certificate design. */
function AdminCertificateTemplatesContent() {
  const templates = useCertificateTemplates();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Certificates</h1>
          <p className="text-sm text-muted-foreground">Designs set the wording, colours, logos and signatories.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/certificates/templates/new">
            <Plus aria-hidden className="size-4" />
            New design
          </Link>
        </Button>
      </div>

      <CertificatesTabs active="templates" />

      {templates.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-16 w-full" />
          ))}
        </div>
      ) : templates.isError ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border p-6">
          <p className="text-sm text-destructive">The designs did not load.</p>
          <Button size="sm" variant="outline" onClick={() => void templates.refetch()}>
            <RotateCw aria-hidden className="size-4" />
            Try again
          </Button>
        </div>
      ) : templates.data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
          <Award aria-hidden className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No designs yet. Create one, then make a programme that uses it.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {templates.data.map((template) => (
            <li key={template.uuid}>
              <Link
                href={`/admin/certificates/templates/${template.uuid}`}
                className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className="size-8 shrink-0 rounded-md border"
                  style={{ background: template.colors.primary, borderColor: template.colors.accent }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{template.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">{template.title}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {template.logos?.length ?? 0} logos · {template.signatories?.length ?? 0} signatories
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminCertificateTemplatesPage() {
  return (
    <SuperadminGate>
      <AdminCertificateTemplatesContent />
    </SuperadminGate>
  );
}
