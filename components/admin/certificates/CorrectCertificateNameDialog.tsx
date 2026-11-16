'use client';

import { useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PRINTED_NAME_MAX, correctedNameProblem, printedNameErrorOf } from '@/lib/certificates/model';
import { useCorrectCertificateName } from '@/lib/hooks/useAdminCertificates';
import { extractApiError } from '@/lib/utils/api-error';
import type { IssuedCertificate } from '@/types/certificates';

/**
 * "Correct name" on one issued certificate (Stay, 16 November 2026, thread
 * cc930a51; Backend b6a83af4). The admin sees the name printed now, types the
 * right one, and the certificate's PDF is drawn again with it. The number, the
 * verify link and the issued date stay the same, and no email goes out, which
 * the dialog says before the change is made. A refusal is shown under the box,
 * in the server's words. Mounted only while open, so each opening starts from
 * the certificate's current name.
 */
export function CorrectCertificateNameDialog({
  programmeUuid,
  certificate,
  onOpenChange,
}: {
  programmeUuid: string;
  certificate: IssuedCertificate & { uuid: string };
  onOpenChange: (open: boolean) => void;
}) {
  const inputId = useId();
  const errorId = useId();
  const correct = useCorrectCertificateName(programmeUuid);
  const [name, setName] = useState(certificate.printed_name);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const problem = correctedNameProblem(name);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    correct.mutate(
      { certificateUuid: certificate.uuid, printedName: name },
      {
        onSuccess: ({ message }) => {
          toast.success(message);
          onOpenChange(false);
        },
        onError: (failure) => {
          const apiError = extractApiError(failure);
          setError(printedNameErrorOf(apiError.errors) ?? apiError.message);
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(next) => !correct.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct the name</DialogTitle>
          <DialogDescription>
            Certificate <span className="font-mono text-foreground">{certificate.number}</span> now reads{' '}
            <span className="font-semibold text-foreground">{certificate.printed_name}</span>. The PDF is drawn again
            with the new name. The number and verify link stay the same, and no email goes out.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-2 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Label htmlFor={inputId}>Name on the certificate</Label>
          <Input
            id={inputId}
            value={name}
            maxLength={PRINTED_NAME_MAX}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            disabled={correct.isPending}
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            autoComplete="off"
          />
          {error ? (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={correct.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={correct.isPending}>
            {correct.isPending ? <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" /> : null}
            Correct name
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
