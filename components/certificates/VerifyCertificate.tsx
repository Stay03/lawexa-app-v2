'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, CircleSlash, Loader2, RotateCw, SearchX, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { fetchCertificateVerification } from '@/lib/api/certificates-public';
import { formatCertificateDate, normalizeCertificateNumber, type VerificationOutcome } from '@/lib/certificates/model';
import type { CertificateVerification } from '@/types/certificates';

/**
 * The verify check itself, run in the visitor's browser so each visitor has
 * their own rate limit (Techlead 113d06a1). Three answers stay apart: found
 * (valid or withdrawn), not found (a 404, or a number that cannot exist), and
 * "could not check" (anything else), because telling an employer that a real
 * certificate is not genuine is the worst mistake this page can make.
 */
export function VerifyCertificate({ rawNumber }: { rawNumber: string }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; outcome: VerificationOutcome } | null>(null);
  const shown = normalizeCertificateNumber(rawNumber);

  useEffect(() => {
    const controller = new AbortController();
    fetchCertificateVerification(rawNumber, controller.signal).then((outcome) => {
      if (!controller.signal.aborted) setResult({ attempt, outcome });
    });
    return () => controller.abort();
  }, [rawNumber, attempt]);

  if (!result || result.attempt !== attempt) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-3xl border bg-card p-10 text-center shadow-sm" aria-busy="true">
        <Loader2 aria-hidden className="size-6 animate-spin text-muted-foreground" />
        <p role="status" className="text-sm text-muted-foreground">
          Checking the certificate…
        </p>
      </section>
    );
  }

  const { outcome } = result;
  if (outcome.kind === 'found') return <FoundCard certificate={outcome.certificate} />;
  if (outcome.kind === 'not_found') {
    return (
      <MessageCard
        icon={<SearchX className="size-6" />}
        title="No certificate with this number"
        body={
          shown
            ? `Lawexa has not issued a certificate numbered ${shown}. Check the number on the certificate, letter by letter, and try the link again.`
            : 'This is not a Lawexa certificate number. Check the address printed on the certificate, letter by letter. Numbers look like LX-2026-000123-K7Q9M.'
        }
      />
    );
  }
  return (
    <MessageCard
      tone="alarm"
      icon={<TriangleAlert className="size-6" />}
      title="We couldn't check this certificate just now"
      body="This says nothing about whether it is genuine. Please try again in a minute."
      action={
        <Button size="sm" variant="outline" onClick={() => setAttempt((count) => count + 1)}>
          <RotateCw aria-hidden className="size-4" />
          Try again
        </Button>
      }
    />
  );
}

function FoundCard({ certificate }: { certificate: CertificateVerification }) {
  const eventDate = formatCertificateDate(certificate.event_date);
  const issuedDate = formatCertificateDate(certificate.issued_at);

  return (
    <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
      {certificate.logos.length > 0 && (
        <ul className="mb-6 flex flex-wrap items-center justify-center gap-6" aria-label="Issued by">
          {certificate.logos.map((logo) => (
            <li key={logo.url}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the API serves the logo; next/image would need its host configured */}
              <img src={logo.url} alt={logo.label ?? ''} className="h-10 w-auto max-w-[9rem] object-contain" />
            </li>
          ))}
        </ul>
      )}

      {certificate.valid ? (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <BadgeCheck aria-hidden className="size-5 shrink-0" />
          Genuine certificate, issued by Lawexa
        </p>
      ) : (
        <p className="flex items-center gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          <CircleSlash aria-hidden className="size-5 shrink-0" />
          This certificate has been withdrawn and is no longer valid
        </p>
      )}

      <p className="mt-6 text-[0.6875rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Awarded to</p>
      <h1 className="mt-1 font-fraunces text-2xl leading-tight font-semibold text-balance text-foreground sm:text-3xl">
        {certificate.printed_name}
      </h1>

      <dl className="mt-6 grid gap-4 text-sm">
        <Detail label="Programme" value={certificate.programme} />
        {certificate.partner_name && <Detail label="In partnership with" value={certificate.partner_name} />}
        {eventDate && <Detail label="Date" value={eventDate} />}
        {issuedDate && <Detail label="Issued" value={issuedDate} />}
        <Detail label="Certificate number" value={certificate.number} mono />
      </dl>
    </section>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'mt-0.5 font-mono tabular-nums text-foreground' : 'mt-0.5 text-pretty text-foreground'}>
        {value}
      </dd>
    </div>
  );
}

function MessageCard({
  icon,
  title,
  body,
  action,
  tone = 'quiet',
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
  tone?: 'quiet' | 'alarm';
}) {
  return (
    <section className="rounded-3xl border bg-card p-8 text-center shadow-sm">
      <span
        aria-hidden
        className={
          tone === 'alarm'
            ? 'mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive'
            : 'mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground'
        }
      >
        {icon}
      </span>
      <h1 className="mt-4 font-fraunces text-xl font-semibold text-foreground">{title}</h1>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-pretty text-muted-foreground">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </section>
  );
}
