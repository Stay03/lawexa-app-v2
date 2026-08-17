'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { FileText, Loader2, Upload, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractApiError } from '@/lib/utils/api-error';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import {
  BN_NUMBER_MAX,
  CAC_ACCEPT_ATTR,
  validateCacDocument,
} from './model';
import { useRequestVerification } from './mutations';

/**
 * RequestVerificationDialog — the registration number + CAC document, the
 * multipart request that moves an organization into review (study A8: KEEP).
 *
 * ── THE LABEL IS NOT THE FIELD NAME, DELIBERATELY ──────────────────────────
 * The field is `bn_number` and the label says "BN or RC number", because those
 * are different questions. @arthur, 17 August 2026: "please note its BN number
 * or RC Number". It was not a wording preference — the only real applicant we
 * had put "RC 1716380" into a box our own form called Business Number, so the
 * form was already wrong for 100% of the companies that had used it.
 *
 * Renaming the stored field would be a migration for no gain: the server, the
 * reports and the admin screen all agree on `bn_number` today. What a person
 * reads is what had to change.
 *
 * CLIENT-SIDE VALIDATION IS A COURTESY, NOT A GATE. The type and size checks
 * run before the upload so a wrong file is answered instantly instead of after
 * ten megabytes have crossed the wire — but the SERVER stays authoritative
 * (its validation is content-based) and its sentence is what appears if it
 * refuses. A rejected pick leaves the previous selection alone rather than
 * clearing it, so one mis-click does not cost the file you already chose.
 *
 * The picked file is shown as a REMOVABLE chip rather than as text inside the
 * button, because "how do I choose a different one?" is the immediate next
 * question and swapping the label answers it only by accident.
 *
 * Failures surface inline (`silentError` mutation). On success the dialog
 * closes AND calls {@link RequestVerificationDialogProps.onSubmitted}, which is
 * what actually moves the panel behind it into "under review": the response
 * cannot do that on its own, because `verification_requested_at` is admin-only
 * and is stripped from the submitter's copy (see `model.ts`). Without that
 * callback the dialog would close onto an unchanged "Get verified" panel —
 * a successful upload with no acknowledgement whatsoever. Phase-5 W4,
 * 2026-08-04.
 */
export function RequestVerificationDialog({
  open,
  onOpenChange,
  organizationUuid,
  organizationName,
  viewerId,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationUuid: string;
  organizationName: string;
  viewerId: number | null;
  /** Called once the request RESOLVES successfully — the screen turns this
   *  into the under-review state the payload cannot express. */
  onSubmitted: () => void;
}) {
  const request = useRequestVerification(organizationUuid, viewerId);
  const inputRef = useRef<HTMLInputElement>(null);

  const [bnNumber, setBnNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitting = request.isPending;
  const canSubmit = bnNumber.trim().length > 0 && file !== null && !submitting;

  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    // Reset the input so picking the SAME file again still fires a change
    // event (a browser quirk that otherwise makes re-selection silently fail).
    event.target.value = '';
    if (!picked) return;
    const failure = validateCacDocument(picked);
    if (failure) {
      setError(failure);
      return;
    }
    setError(null);
    setFile(picked);
  };

  const handleSubmit = () => {
    if (!canSubmit || !file) return;
    setError(null);
    request.mutate(
      { bn_number: bnNumber.trim(), cac_document: file },
      {
        onSuccess: () => {
          onSubmitted();
          onOpenChange(false);
        },
        onError: (failure) => setError(extractApiError(failure).message),
      },
    );
  };

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={`Verify ${organizationName}`}
      description="Send your registration number and CAC document. A reviewer checks them and the badge appears on your organization when it’s approved."
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 aria-hidden className="size-4 animate-spin" />}
            Submit for review
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bn-number">BN or RC number</Label>
          <Input
            id="bn-number"
            maxLength={BN_NUMBER_MAX}
            autoComplete="off"
            placeholder="e.g. RC 1716380 or BN1234567"
            value={bnNumber}
            onChange={(event) => setBnNumber(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cac-document">CAC document</Label>
          <input
            ref={inputRef}
            id="cac-document"
            type="file"
            accept={CAC_ACCEPT_ATTR}
            className="sr-only"
            onChange={handlePick}
          />

          {file ? (
            <div className="flex items-center gap-2 rounded-lg border bg-secondary/40 px-3 py-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
              <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm" title={file.name}>
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => setFile(null)}
                aria-label={`Remove ${file.name}`}
                className={cn(
                  'v2-interactive flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground motion-reduce:transition-none',
                  FOCUS_RING,
                )}
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="v2-interactive w-full justify-start font-normal"
              onClick={() => inputRef.current?.click()}
            >
              <Upload aria-hidden className="size-4 shrink-0" />
              Choose a file
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            PDF, JPG or PNG, up to 10&nbsp;MB.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {error}
          </p>
        )}
      </div>
    </ResponsiveOverlay>
  );
}
