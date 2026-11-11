'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, PenLine, Trash2, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminCertificatesApi } from '@/lib/api/certificates';
import { bySort, certificateImageProblem, moveBySort } from '@/lib/certificates/model';
import {
  useAddCertificateSignatory,
  useDeleteCertificateSignatory,
  useUpdateCertificateSignatories,
} from '@/lib/hooks/useAdminCertificates';
import { extractApiError } from '@/lib/utils/api-error';
import type { CertificateSignatory } from '@/types/certificates';

/**
 * Who signs: name, title and a signature picture (PNG or JPG, up to 2 MB). The
 * picture's address is admin-only (WOZ 2743bdc3), so it is fetched with the
 * session and shown from a blob.
 */
export function TemplateSignatories({
  templateUuid,
  signatories,
}: {
  templateUuid: string;
  signatories: CertificateSignatory[];
}) {
  const add = useAddCertificateSignatory(templateUuid);
  const update = useUpdateCertificateSignatories(templateUuid);
  const remove = useDeleteCertificateSignatory(templateUuid);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [signature, setSignature] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pictureVersion, setPictureVersion] = useState(0);
  const ordered = bySort(signatories);

  const fail = (cause: unknown) => setProblem(extractApiError(cause).message);

  const pickSignature = (file: File | undefined, onPicked: (file: File) => void) => {
    if (!file) return;
    const reason = certificateImageProblem(file, 'signature');
    if (reason) {
      setProblem(reason);
      return;
    }
    setProblem(null);
    onPicked(file);
  };

  const submit = () => {
    if (!name.trim()) {
      setProblem('Add the signatory’s name.');
      return;
    }
    add.mutate(
      { name: name.trim(), title: title.trim(), signature },
      {
        onSuccess: () => {
          setName('');
          setTitle('');
          setSignature(null);
          setProblem(null);
        },
        onError: fail,
      },
    );
  };

  const save = (signatory: CertificateSignatory, changes: Partial<{ name: string; title: string; signature: File; removeSignature: boolean }>) => {
    update.mutate(
      [
        {
          uuid: signatory.uuid,
          name: changes.name ?? signatory.name,
          title: changes.title ?? signatory.title ?? '',
          sort: signatory.sort,
          signature: changes.signature ?? null,
          removeSignature: changes.removeSignature,
        },
      ],
      { onError: fail, onSuccess: () => setPictureVersion((count) => count + 1) },
    );
  };

  const move = (uuid: string, direction: -1 | 1) => {
    update.mutate(
      moveBySort(signatories, uuid, direction).map((item) => ({
        uuid: item.uuid,
        name: item.name,
        title: item.title ?? '',
        sort: item.sort,
      })),
      { onError: fail },
    );
  };

  return (
    <section aria-labelledby="certificate-signatories-heading" className="space-y-3">
      <div>
        <h2 id="certificate-signatories-heading" className="text-sm font-semibold">
          Signatories
        </h2>
        <p className="text-xs text-muted-foreground">Printed along the bottom, left to right, in this order.</p>
      </div>

      {ordered.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {ordered.map((signatory, index) => (
            <li key={signatory.uuid} className="flex flex-wrap items-center gap-3 p-2.5">
              <SignatureThumb url={signatory.signature_url} version={pictureVersion} />
              <div className="grid min-w-48 flex-1 gap-1.5 sm:grid-cols-2">
                <Input
                  aria-label="Signatory name"
                  defaultValue={signatory.name}
                  className="h-8"
                  onBlur={(event) => {
                    const next = event.target.value.trim();
                    if (next && next !== signatory.name) save(signatory, { name: next });
                  }}
                />
                <Input
                  aria-label="Signatory title"
                  defaultValue={signatory.title ?? ''}
                  placeholder="Founder & CEO, Lawexa"
                  className="h-8"
                  onBlur={(event) => {
                    const next = event.target.value.trim();
                    if (next !== (signatory.title ?? '')) save(signatory, { title: next });
                  }}
                />
              </div>
              <div className="flex shrink-0 gap-1">
                <SignatureButton
                  label={signatory.signature_url ? `Replace ${signatory.name}’s signature` : `Add ${signatory.name}’s signature`}
                  disabled={update.isPending}
                  onFile={(file) => pickSignature(file, (picked) => save(signatory, { signature: picked }))}
                />
                {signatory.signature_url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    disabled={update.isPending}
                    onClick={() => save(signatory, { removeSignature: true })}
                  >
                    Clear signature
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label={`Move ${signatory.name} left`}
                  disabled={index === 0 || update.isPending}
                  onClick={() => move(signatory.uuid, -1)}
                >
                  <ArrowLeft aria-hidden className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label={`Move ${signatory.name} right`}
                  disabled={index === ordered.length - 1 || update.isPending}
                  onClick={() => move(signatory.uuid, 1)}
                >
                  <ArrowRight aria-hidden className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-destructive hover:text-destructive"
                  aria-label={`Remove ${signatory.name}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(signatory.uuid, { onError: fail })}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="new-signatory-name">Name</Label>
          <Input id="new-signatory-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-signatory-title">Title</Label>
          <Input
            id="new-signatory-title"
            placeholder="President, LASU LSS"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <SignatureButton
          label={signature ? `Signature: ${signature.name}` : 'Signature picture'}
          showLabel
          onFile={(file) => pickSignature(file, setSignature)}
        />
        <Button type="button" disabled={add.isPending} onClick={submit}>
          {add.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <UserPlus aria-hidden className="size-4" />}
          Add signatory
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

function SignatureButton({
  label,
  onFile,
  disabled,
  showLabel = false,
}: {
  label: string;
  onFile: (file: File | undefined) => void;
  disabled?: boolean;
  showLabel?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <Button
        type="button"
        variant="outline"
        size={showLabel ? 'default' : 'icon'}
        className={showLabel ? 'max-w-56' : 'size-8'}
        aria-label={showLabel ? undefined : label}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <PenLine aria-hidden className="size-4" />
        {showLabel && <span className="truncate">{label}</span>}
      </Button>
    </>
  );
}

/** The admin-only signature picture, read with the session. */
function SignatureThumb({ url, version }: { url: string | null; version: number }) {
  const key = url ? `${url}#${version}` : null;
  const [loaded, setLoaded] = useState<{ key: string; src: string } | null>(null);
  const src = loaded && loaded.key === key ? loaded.src : null;

  useEffect(() => {
    if (!url || !key) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    adminCertificatesApi
      .signatureImage(url)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ key, src: objectUrl });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, key]);

  return (
    <span className="flex h-10 w-20 shrink-0 items-center justify-center rounded bg-muted p-1 text-[0.625rem] text-muted-foreground">
      {/* eslint-disable-next-line @next/next/no-img-element -- a blob of the admin-only picture */}
      {src ? <img src={src} alt="" className="max-h-full max-w-full object-contain" /> : url ? 'Loading' : 'No signature'}
    </span>
  );
}
