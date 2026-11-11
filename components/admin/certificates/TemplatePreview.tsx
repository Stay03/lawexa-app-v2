'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminCertificatesApi } from '@/lib/api/certificates';
import { extractApiError } from '@/lib/utils/api-error';
import type { CertificatePreviewPayload } from '@/types/certificates';

/** How long typing must pause before the PDF is redrawn. */
const PREVIEW_DELAY_MS = 800;

/**
 * The live preview: the saved design with the form's unsaved title, wording and
 * colours drawn on top, as the real PDF (`POST .../preview`, which saves
 * nothing). Only the latest request's answer is shown, so a slow early PDF never
 * replaces a newer one.
 */
export function TemplatePreview({
  templateUuid,
  overrides,
  version,
}: {
  templateUuid: string;
  overrides: Omit<CertificatePreviewPayload, 'name' | 'score'>;
  /** Bumped when logos or signatories change, which the overrides do not carry. */
  version: string;
}) {
  const [sampleName, setSampleName] = useState('Adaeze Okafor');
  const [sampleScore, setSampleScore] = useState('85');
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const latest = useRef(0);
  const shownUrl = useRef<string | null>(null);

  const key = JSON.stringify([overrides, sampleName, sampleScore, version, retry]);

  useEffect(() => {
    const request = ++latest.current;
    setState('loading');
    const timer = setTimeout(async () => {
      try {
        const score = sampleScore.trim() === '' ? null : Number(sampleScore);
        const file = await adminCertificatesApi.preview(templateUuid, {
          ...overrides,
          name: sampleName.trim() || undefined,
          score: score !== null && Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : null,
        });
        if (request !== latest.current) return;
        if (shownUrl.current) URL.revokeObjectURL(shownUrl.current);
        shownUrl.current = URL.createObjectURL(file.blob);
        setUrl(shownUrl.current);
        setState('ready');
      } catch (cause) {
        if (request !== latest.current) return;
        const apiError = extractApiError(cause);
        setError(
          apiError.status === 429
            ? 'Too many previews in a minute. Wait a moment, then press Try again.'
            : apiError.status === 422
              ? apiError.message
              : 'The preview did not load.',
        );
        setState('error');
      }
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
    // `key` carries every input; the objects themselves change identity on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateUuid, key]);

  useEffect(
    () => () => {
      if (shownUrl.current) URL.revokeObjectURL(shownUrl.current);
    },
    [],
  );

  return (
    <section aria-labelledby="certificate-preview-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="certificate-preview-heading" className="text-sm font-semibold">
          Preview
        </h2>
        {state === 'loading' && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <Loader2 aria-hidden className="size-3.5 animate-spin" />
            Drawing the PDF
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="preview-name">Sample name</Label>
          <Input id="preview-name" value={sampleName} onChange={(event) => setSampleName(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="preview-score">Score %</Label>
          <Input
            id="preview-score"
            inputMode="decimal"
            value={sampleScore}
            onChange={(event) => setSampleScore(event.target.value.replace(/[^\d.]/g, ''))}
          />
        </div>
      </div>

      <div className="relative aspect-[1.414/1] w-full overflow-hidden rounded-lg border bg-muted">
        {url && (
          <iframe
            title="Certificate preview"
            src={`${url}#toolbar=0&navpanes=0&view=Fit`}
            className="size-full"
          />
        )}
        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 p-6 text-center">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button size="sm" variant="outline" onClick={() => setRetry((count) => count + 1)}>
              <RotateCw aria-hidden className="size-4" />
              Try again
            </Button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        The preview uses your unsaved wording and colours. Nothing is saved until you press Save.
      </p>
    </section>
  );
}
