'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Award, Loader2, RefreshCw, RotateCw, X } from 'lucide-react';

import { AdminUserSinglePicker, type AdminUserSinglePickerValue } from '@/components/admin/AdminUserSinglePicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  certificateVerifyPath,
  formatCertificateDate,
  formatCertificateScore,
  issueSummary,
} from '@/lib/certificates/model';
import {
  useIssueCertificates,
  useIssuedCertificates,
  useRerenderCertificateProgramme,
} from '@/lib/hooks/useAdminCertificates';
import { extractApiError } from '@/lib/utils/api-error';
import type { CertificateProgramme } from '@/types/certificates';

/** The most people the server issues to in one go (WOZ's IssueCertificatesRequest). */
const MAX_PEOPLE = 500;

/**
 * Issuing by hand, and every certificate the programme has issued. Automatic
 * issuing from a quiz waits for Stay's answers (pass mark, printed name, email).
 */
export function ProgrammeCertificates({ programme }: { programme: CertificateProgramme }) {
  return (
    <div className="space-y-8">
      <IssuePanel programme={programme} />
      <IssuedList programmeUuid={programme.uuid} />
    </div>
  );
}

function IssuePanel({ programme }: { programme: CertificateProgramme }) {
  const issue = useIssueCertificates(programme.uuid);
  const [people, setPeople] = useState<Array<{ uuid: string; name: string; email: string | null }>>([]);
  const [score, setScore] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const add = (picked: AdminUserSinglePickerValue | null) => {
    if (!picked?.uuid) return;
    const uuid = picked.uuid;
    setPeople((current) =>
      current.some((person) => person.uuid === uuid) || current.length >= MAX_PEOPLE
        ? current
        : [...current, { uuid, name: picked.name, email: picked.email }],
    );
    setResult(null);
  };

  const submit = () => {
    setProblem(null);
    setResult(null);
    const parsed = score.trim() === '' ? null : Number(score);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || parsed > 100)) {
      setProblem('A score is a percentage from 0 to 100, or blank.');
      return;
    }
    issue.mutate(
      { user_uuids: people.map((person) => person.uuid), score: parsed },
      {
        onSuccess: (answer) => {
          setResult(issueSummary(answer));
          setPeople([]);
          setScore('');
        },
        onError: (cause) => setProblem(extractApiError(cause).message),
      },
    );
  };

  return (
    <section aria-labelledby="issue-heading" className="max-w-2xl space-y-3">
      <div>
        <h2 id="issue-heading" className="text-lg font-semibold">
          Issue certificates
        </h2>
        <p className="text-sm text-muted-foreground">
          Pick people by name or email. Anyone who already has this programme’s certificate keeps the one they have.
        </p>
      </div>

      {!programme.is_active && (
        <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          This programme is switched off, so it cannot issue certificates. Switch it on above first.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <AdminUserSinglePicker value={null} onChange={add} placeholder="Add a person…" disabled={!programme.is_active} />
        <div className="w-28 space-y-1.5">
          <Label htmlFor="issue-score">Score %</Label>
          <Input
            id="issue-score"
            inputMode="decimal"
            placeholder="Optional"
            value={score}
            onChange={(event) => setScore(event.target.value.replace(/[^\d.]/g, ''))}
          />
        </div>
        <Button onClick={submit} disabled={people.length === 0 || issue.isPending || !programme.is_active}>
          {issue.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Award aria-hidden className="size-4" />}
          Issue {people.length > 0 ? people.length : ''} {people.length === 1 ? 'certificate' : 'certificates'}
        </Button>
      </div>

      {people.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="People to issue to">
          {people.map((person) => (
            <li key={person.uuid}>
              <Badge variant="secondary" className="gap-1 py-1 pr-1 pl-2.5">
                <span className="max-w-56 truncate">{person.name || person.email}</span>
                <button
                  type="button"
                  aria-label={`Remove ${person.name || person.email}`}
                  className="rounded-full p-0.5 hover:bg-foreground/10"
                  onClick={() => setPeople((current) => current.filter((item) => item.uuid !== person.uuid))}
                >
                  <X aria-hidden className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {result && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {result}
        </p>
      )}
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
    </section>
  );
}

function IssuedList({ programmeUuid }: { programmeUuid: string }) {
  const [page, setPage] = useState(1);
  const list = useIssuedCertificates(programmeUuid, page);
  const rerender = useRerenderCertificateProgramme(programmeUuid);
  const [rerenderNote, setRerenderNote] = useState<string | null>(null);

  const redraw = () => {
    setRerenderNote(null);
    rerender.mutate(undefined, {
      onSuccess: (queued) =>
        setRerenderNote(`${queued} ${queued === 1 ? 'PDF is' : 'PDFs are'} being redrawn with the current design.`),
      onError: (cause) => setRerenderNote(extractApiError(cause).message),
    });
  };

  return (
    <section aria-labelledby="issued-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="issued-heading" className="text-lg font-semibold">
          Issued{list.data ? ` (${list.data.total})` : ''}
        </h2>
        {list.data && list.data.total > 0 && (
          <Button size="sm" variant="outline" disabled={rerender.isPending} onClick={redraw}>
            {rerender.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <RefreshCw aria-hidden className="size-4" />}
            Redraw PDFs with the current design
          </Button>
        )}
      </div>
      {rerenderNote && (
        <p role="status" className="text-sm text-muted-foreground">
          {rerenderNote}
        </p>
      )}

      {list.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.isError ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-destructive">The certificates did not load.</p>
          <Button size="sm" variant="outline" onClick={() => void list.refetch()}>
            <RotateCw aria-hidden className="size-4" />
            Try again
          </Button>
        </div>
      ) : list.data.items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No certificates issued yet.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Printed name</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((certificate) => (
                  <TableRow key={certificate.number}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={certificateVerifyPath(certificate.number)}
                        target="_blank"
                        rel="noopener"
                        className="underline-offset-4 hover:underline"
                      >
                        {certificate.number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {certificate.user?.uuid ? (
                        <Link href={`/admin/users/${certificate.user.uuid}`} className="underline-offset-4 hover:underline">
                          {certificate.printed_name}
                        </Link>
                      ) : (
                        certificate.printed_name
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatCertificateScore(certificate.score) || '—'}</TableCell>
                    <TableCell>{formatCertificateDate(certificate.issued_at)}</TableCell>
                    <TableCell>
                      {certificate.revoked_at ? (
                        <Badge variant="destructive">Withdrawn</Badge>
                      ) : (
                        <Badge variant="secondary">Valid</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {list.data.lastPage > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Previous
              </Button>
              <span className="text-muted-foreground tabular-nums">
                Page {list.data.page} of {list.data.lastPage}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= list.data.lastPage}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
