'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Award, Check, Download, Link2, Loader2, RotateCw, ShieldCheck, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  certificateVerifyPath,
  formatCertificateDate,
  formatCertificateScore,
} from '@/lib/certificates/model';
import type { MyCertificate, PendingCertificate } from '@/types/certificates';
import { SETTINGS_BLOCK, SETTINGS_COLUMN } from '../SettingsList';
import { SettingsState } from '../SettingsState';
import { ConfirmNameCard } from './ConfirmNameCard';
import { myCertificatesQueries, useDownloadCertificate } from './queries';

/**
 * v2 `/settings/certificates`: the certificates Lawexa has issued to this
 * account, each with its PDF and its public verify link (Techlead e465210e).
 */
export function CertificatesScreen() {
  const list = useQuery(myCertificatesQueries.list());
  // A failed pending read hides the section rather than blocking the issued list.
  const pending = useQuery(myCertificatesQueries.pending());
  const waiting = pending.data ?? [];

  if (list.isPending) return <CertificatesFallback />;

  if (list.isError) {
    return (
      <div className={SETTINGS_COLUMN}>
        <SettingsState
          icon={TriangleAlert}
          tone="alarm"
          title="Your certificates did not load"
          description="Check your connection and try again."
          action={
            <Button size="sm" variant="outline" disabled={list.isFetching} onClick={() => void list.refetch()}>
              <RotateCw aria-hidden className={cn('size-4', list.isFetching && 'animate-spin')} />
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  if (list.data.length === 0 && waiting.length === 0) {
    return (
      <div className={SETTINGS_COLUMN}>
        <SettingsState
          icon={Award}
          title="No certificates yet"
          description="When you take part in a Lawexa programme or event that awards one, your certificate appears here."
        />
      </div>
    );
  }

  return (
    <div className={SETTINGS_COLUMN}>
      <h1 className="mb-5 hidden text-2xl font-semibold text-foreground md:block">Certificates</h1>
      {waiting.length > 0 && <PendingNames pending={waiting} />}
      {list.data.length > 0 && (
        <ul className={SETTINGS_BLOCK} aria-label="Your certificates">
          {list.data.map((certificate) => (
            <CertificateRow key={certificate.number} certificate={certificate} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Certificates waiting for the printed name, above the issued ones (Techlead 60c6e758). */
function PendingNames({ pending }: { pending: PendingCertificate[] }) {
  return (
    <section aria-labelledby="pending-names-heading" className="mb-6">
      <h2 id="pending-names-heading" className="mb-2 text-sm font-semibold text-foreground">
        {pending.length === 1 ? 'One certificate needs your name' : `${pending.length} certificates need your name`}
      </h2>
      <ul className={SETTINGS_BLOCK}>
        {pending.map((item) => (
          <li key={item.uuid}>
            <ConfirmNameCard pendingUuid={item.uuid} programme={item.programme} suggestedName={item.suggested_name} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CertificateRow({ certificate }: { certificate: MyCertificate }) {
  const download = useDownloadCertificate();
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const verifyPath = certificateVerifyPath(certificate.number);
  const details = [
    certificate.programme.partner_name,
    formatCertificateDate(certificate.programme.event_date),
    formatCertificateScore(certificate.score) && `Score ${formatCertificateScore(certificate.score)}`,
  ].filter(Boolean);

  const verifyUrl = () => `${window.location.origin}${verifyPath}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl());
      setCopy('copied');
      setTimeout(() => setCopy('idle'), 2000);
    } catch {
      setCopy('failed');
    }
  };

  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Award className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-pretty text-foreground">
            {certificate.programme.name}
            {certificate.valid === false && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Withdrawn</span>
            )}
          </p>
          {details.length > 0 && <p className="mt-0.5 text-sm text-muted-foreground">{details.join(' · ')}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            Issued to {certificate.printed_name} · <span className="font-mono tabular-nums">{certificate.number}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 sm:pl-13">
        <Button
          size="sm"
          disabled={download.isPending}
          onClick={() => download.mutate(certificate.number)}
        >
          {download.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Download aria-hidden className="size-4" />}
          Download PDF
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={verifyPath} target="_blank" rel="noopener">
            <ShieldCheck aria-hidden className="size-4" />
            Verify page
          </Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void copyLink()}>
          {copy === 'copied' ? <Check aria-hidden className="size-4" /> : <Link2 aria-hidden className="size-4" />}
          {copy === 'copied' ? 'Link copied' : 'Copy verify link'}
        </Button>
      </div>

      {copy === 'failed' && (
        <p role="alert" className="text-sm break-all text-destructive sm:pl-13">
          The link could not be copied. Copy it from here: {verifyUrl()}
        </p>
      )}
      {download.isError && (
        <p role="alert" className="text-sm text-destructive sm:pl-13">
          The PDF did not download. Try again in a moment.
        </p>
      )}
    </li>
  );
}

function CertificatesFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your certificates
      </span>
      <div aria-hidden inert className={SETTINGS_COLUMN}>
        <Skeleton className="mb-5 hidden h-8 w-36 rounded-lg md:block" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </div>
    </>
  );
}
