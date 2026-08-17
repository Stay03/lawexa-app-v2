'use client';

import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';

/**
 * Opens the certificate a company sent, or says plainly why it cannot.
 *
 * ── THE LINK IS NOT THE FILE ───────────────────────────────────────────────
 * `GET /files/{id}/download` does NOT return the document. Since the storage
 * fix of 17 August 2026 it answers with JSON carrying a temporary signed link,
 * which is then opened. That is the point of the fix: a company's registration
 * certificate does not sit at a guessable public address, and the link it is
 * fetched through expires.
 *
 * @backendclaude warned about this shape BEFORE the fix deployed, when the same
 * route still streamed the file straight back: "if you build against what it
 * does right now you will ship a broken button an hour later." So this button
 * was deliberately not built until he had confirmed the deploy by uploading a
 * document and opening it, rather than when the commit landed.
 *
 * ── AND IT WILL FAIL, TODAY, ON THE ONLY COMPANY IN THE QUEUE ──────────────
 * Every certificate uploaded before that fix was written to a folder our
 * deploys delete. Law Guide Technology's is one of them: the route answers 404,
 * "File not found on storage." The record survives, so the filename and size
 * still show and the document looks present.
 *
 * A raw failure there would read as a broken button and teach a reviewer to
 * distrust the screen. So that one case is answered in words a person can act
 * on — the file is gone, ask them to send it again — and every other failure
 * shows the server's own sentence rather than a generic apology.
 */
export function OpenCertificateButton({
  fileId,
  fileName,
}: {
  fileId: number;
  fileName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await apiClient.get<{ data?: { url?: string } }>(
        `/files/${fileId}/download`,
      );
      const url = response.data?.data?.url;
      if (!url) {
        setError(
          'The server did not send a link for this file. Nothing has been lost — tell the team and it will be looked at.',
        );
        return;
      }
      /* A new tab, not this one: the reviewer is mid-decision and losing the
         screen behind the certificate would cost them the row they were on.
         `noopener` because the opened document is on storage we do not own. */
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        onClick={() => void open()}
        disabled={busy}
        className="gap-2"
      >
        {busy ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
        ) : (
          <ExternalLink aria-hidden className="h-4 w-4" />
        )}
        {busy ? 'Opening' : 'Open certificate'}
        <span className="sr-only"> — {fileName}</span>
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The server's sentence, except for the one failure a reviewer will actually
 * hit today, which is translated into something they can do.
 */
function messageFor(failure: unknown): string {
  const status =
    typeof failure === 'object' && failure !== null && 'response' in failure
      ? (failure as { response?: { status?: number; data?: { message?: string } } })
          .response
      : undefined;

  const said = status?.data?.message ?? '';

  if (status?.status === 404 && /not found on storage/i.test(said)) {
    return 'This certificate is gone. It was uploaded before the storage fix, and those files were deleted by our own deploys. Ask the company to send it again — everything else about their application is intact.';
  }
  return said || 'The certificate could not be opened.';
}
