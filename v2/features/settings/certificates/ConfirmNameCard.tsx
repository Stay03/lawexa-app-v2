'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { Award, Check, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cleanPrintedName, formatCertificateDate, printedNameProblem } from '@/lib/certificates/model';
import { extractApiError } from '@/lib/utils/api-error';
import type { CertificateProgrammeSummary } from '@/types/certificates';
import { useConfirmCertificateName } from './queries';

const CERTIFICATES_HREF = '/settings/certificates';

/**
 * "Your certificate: confirm how your name should be printed" (Techlead
 * 60c6e758). Prefilled from the account. Saving issues the certificate with
 * that name, once; the server answers a repeat with the same certificate, so a
 * double tap cannot issue two. Used at the end of a quiz and on the
 * certificates page.
 */
export function ConfirmNameCard({
  pendingUuid,
  programme,
  suggestedName,
  compact = false,
}: {
  pendingUuid: string;
  programme: CertificateProgrammeSummary;
  suggestedName: string;
  /** On the certificates page, a row in a list rather than a card of its own. */
  compact?: boolean;
}) {
  const inputId = useId();
  const confirm = useConfirmCertificateName();
  const [name, setName] = useState(suggestedName);
  const [problem, setProblem] = useState<string | null>(null);
  const [issuedNumber, setIssuedNumber] = useState<string | null>(null);
  const details = [programme.partner_name, formatCertificateDate(programme.event_date)].filter(Boolean).join(' · ');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const reason = printedNameProblem(name);
    if (reason) {
      setProblem(reason);
      return;
    }
    setProblem(null);
    confirm.mutate(
      { pendingUuid, printedName: cleanPrintedName(name) },
      {
        onSuccess: (certificate) => setIssuedNumber(certificate?.number ?? ''),
        onError: (cause) => {
          const apiError = extractApiError(cause);
          setProblem(apiError.errors?.printed_name?.[0] ?? apiError.message);
        },
      },
    );
  };

  const shell = compact ? 'flex flex-col gap-3 px-4 py-4' : 'flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left';

  return (
    <div>
      {/* One live region that stays mounted through the switch from the form to
          the result, so a screen reader announces the result. */}
      <p className="sr-only" aria-live="polite">
        {issuedNumber !== null ? `Your certificate is ready. ${programme.name}.` : ''}
      </p>
      {issuedNumber !== null ? (
        <div className={shell}>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Check aria-hidden className="size-4 text-primary" />
            Your certificate is ready
          </p>
          <p className="text-sm text-muted-foreground">
            {programme.name}
            {issuedNumber ? ` · ${issuedNumber}` : ''}. We’ll email you a copy too.
          </p>
          {!compact && (
            <Button asChild size="sm" variant="outline" className="self-start">
              <Link href={CERTIFICATES_HREF}>Open my certificates</Link>
            </Button>
          )}
        </div>
      ) : (
        <form className={shell} onSubmit={submit} noValidate>
          <div className="flex items-start gap-3">
            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Award className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Your certificate: confirm how your name should be printed</p>
              <p className="mt-0.5 text-sm text-pretty text-muted-foreground">
                {programme.name}
                {details ? ` · ${details}` : ''}
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={inputId} className="text-sm font-medium text-foreground">
              Name on the certificate
            </label>
            <Input
              id={inputId}
              value={name}
              autoComplete="name"
              maxLength={160}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? `${inputId}-error ${inputId}-hint` : `${inputId}-hint`}
            />
            {problem && (
              <p id={`${inputId}-error`} role="alert" className="text-xs text-destructive">
                {problem}
              </p>
            )}
            <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
              Check the spelling and any accents. It is printed exactly like this and cannot be changed later.
            </p>
          </div>
          <Button type="submit" size="sm" className="self-start" disabled={confirm.isPending}>
            {confirm.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Award aria-hidden className="size-4" />}
            Get my certificate
          </Button>
        </form>
      )}
    </div>
  );
}

/** A finished quiz whose certificate is already issued: where to find it. */
export function CertificateReadyNote({ programme, number }: { programme: CertificateProgrammeSummary; number: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Award aria-hidden className="size-4 text-primary" />
        You have this programme’s certificate
      </p>
      <p className="text-sm text-muted-foreground">
        {programme.name} · <span className="font-mono">{number}</span>
      </p>
      <Button asChild size="sm" variant="outline" className="self-start">
        <Link href={CERTIFICATES_HREF}>Open my certificates</Link>
      </Button>
    </div>
  );
}
