'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { bySort, certificateImageProblem, moveBySort } from '@/lib/certificates/model';
import {
  useAddCertificateLogo,
  useDeleteCertificateLogo,
  useUpdateCertificateLogos,
} from '@/lib/hooks/useAdminCertificates';
import { extractApiError } from '@/lib/utils/api-error';
import type { CertificateLogo } from '@/types/certificates';

/**
 * Logos across the top of the certificate, left to right: Lawexa and any
 * partner (Stay, 11 November 2026: "it carries logo or text of both Lawexa and
 * LASU"). PNG, JPG or SVG, up to 2 MB.
 */
export function TemplateLogos({ templateUuid, logos }: { templateUuid: string; logos: CertificateLogo[] }) {
  const add = useAddCertificateLogo(templateUuid);
  const update = useUpdateCertificateLogos(templateUuid);
  const remove = useDeleteCertificateLogo(templateUuid);
  const fileInput = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const ordered = bySort(logos);

  const upload = (file: File | undefined) => {
    if (!file) return;
    const reason = certificateImageProblem(file, 'logo');
    if (reason) {
      setProblem(reason);
      return;
    }
    setProblem(null);
    add.mutate(
      { file, label: label.trim() || file.name.replace(/\.[^.]+$/, '') },
      {
        onSuccess: () => setLabel(''),
        onError: (cause) => setProblem(extractApiError(cause).message),
      },
    );
  };

  const move = (uuid: string, direction: -1 | 1) => {
    update.mutate(moveBySort(logos, uuid, direction).map(({ uuid: id, label: text, sort }) => ({ uuid: id, label: text, sort })), {
      onError: (cause) => setProblem(extractApiError(cause).message),
    });
  };

  const rename = (logo: CertificateLogo, next: string) => {
    const text = next.trim();
    if (text === logo.label) return;
    update.mutate([{ uuid: logo.uuid, label: text, sort: logo.sort }], {
      onError: (cause) => setProblem(extractApiError(cause).message),
    });
  };

  return (
    <section aria-labelledby="certificate-logos-heading" className="space-y-3">
      <div>
        <h2 id="certificate-logos-heading" className="text-sm font-semibold">
          Logos
        </h2>
        <p className="text-xs text-muted-foreground">Printed across the top, left to right, in this order.</p>
      </div>

      {ordered.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {ordered.map((logo, index) => (
            <li key={logo.uuid} className="flex items-center gap-3 p-2.5">
              <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded bg-muted p-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- served by the API's public logo route */}
                <img src={logo.url} alt="" className="max-h-full max-w-full object-contain" />
              </span>
              <Input
                aria-label="Logo name"
                defaultValue={logo.label}
                onBlur={(event) => rename(logo, event.target.value)}
                className="h-8"
              />
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label={`Move ${logo.label} left`}
                  disabled={index === 0 || update.isPending}
                  onClick={() => move(logo.uuid, -1)}
                >
                  <ArrowLeft aria-hidden className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label={`Move ${logo.label} right`}
                  disabled={index === ordered.length - 1 || update.isPending}
                  onClick={() => move(logo.uuid, 1)}
                >
                  <ArrowRight aria-hidden className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-destructive hover:text-destructive"
                  aria-label={`Remove ${logo.label}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(logo.uuid, { onError: (cause) => setProblem(extractApiError(cause).message) })}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor="new-logo-label">New logo name</Label>
          <Input
            id="new-logo-label"
            placeholder="LASU Law Students’ Society"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            upload(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <Button type="button" variant="outline" disabled={add.isPending} onClick={() => fileInput.current?.click()}>
          {add.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ImagePlus aria-hidden className="size-4" />}
          Upload logo
        </Button>
      </div>
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
    </section>
  );
}
