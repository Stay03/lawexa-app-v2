'use client';

import Link from 'next/link';
import { CalendarDays, Plus, RotateCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CertificatesTabs } from '@/components/admin/certificates/CertificatesTabs';
import { SuperadminGate } from '@/components/admin/certificates/SuperadminGate';
import { formatCertificateDate } from '@/lib/certificates/model';
import { useCertificateProgrammes } from '@/lib/hooks/useAdminCertificates';

/** `/admin/certificates/programmes`: the events that issue certificates. */
function AdminCertificateProgrammesContent() {
  const programmes = useCertificateProgrammes();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Certificates</h1>
          <p className="text-sm text-muted-foreground">A programme is one event or course, with its design and partner.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/certificates/programmes/new">
            <Plus aria-hidden className="size-4" />
            New programme
          </Link>
        </Button>
      </div>

      <CertificatesTabs active="programmes" />

      {programmes.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-16 w-full" />
          ))}
        </div>
      ) : programmes.isError ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border p-6">
          <p className="text-sm text-destructive">The programmes did not load.</p>
          <Button size="sm" variant="outline" onClick={() => void programmes.refetch()}>
            <RotateCw aria-hidden className="size-4" />
            Try again
          </Button>
        </div>
      ) : programmes.data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
          <CalendarDays aria-hidden className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No programmes yet.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {programmes.data.map((programme) => (
            <li key={programme.uuid}>
              <Link
                href={`/admin/certificates/programmes/${programme.uuid}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{programme.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {[programme.partner_name, formatCertificateDate(programme.event_date), programme.template_name]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">{programme.issued_count} issued</span>
                {programme.is_active ? <Badge variant="secondary">Issuing</Badge> : <Badge variant="outline">Off</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminCertificateProgrammesPage() {
  return (
    <SuperadminGate>
      <AdminCertificateProgrammesContent />
    </SuperadminGate>
  );
}
