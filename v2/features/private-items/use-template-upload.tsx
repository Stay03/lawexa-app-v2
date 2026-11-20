'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { extractApiError } from '@/lib/utils/api-error';
import { TEMPLATE_UPLOAD, type TemplateUploadResult } from '@/types/private-items';
import { refusalLine, splitUpload } from './model';

/**
 * The template file picker, shared by My templates and Firm templates. Files
 * the server would refuse are named at once and never sent; what the server
 * refuses (a duplicate) is named from its answer. The lines stay on the page
 * under the button until the next upload, so a person who added ten files can
 * read which ones did not go.
 */
export function useTemplateUpload<Row>(send: (files: File[]) => Promise<TemplateUploadResult<Row>>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lines, setLines] = useState<string[]>([]);

  const upload = async (picked: File[]) => {
    const { accepted, refused, overCount } = splitUpload(picked);
    const found = refused.map((file) => refusalLine(file.original_name, file.reason));
    if (overCount) found.push(`Only ${TEMPLATE_UPLOAD.maxFiles} files go at a time; the first ${TEMPLATE_UPLOAD.maxFiles} were added.`);
    setLines(found);
    if (accepted.length === 0) return;
    setUploading(true);
    try {
      const result = await send(accepted);
      const added = result.created.length;
      setLines([...found, ...result.refused.map((file) => refusalLine(file.original_name, file.reason))]);
      if (added > 0) toast.success(added === 1 ? 'Template added. Lawexa is reading it.' : `${added} templates added. Lawexa is reading them.`);
    } catch (error) {
      setLines([...found, extractApiError(error).message]);
    } finally {
      setUploading(false);
    }
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={TEMPLATE_UPLOAD.accept}
      multiple
      hidden
      onChange={(event) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';
        void upload(files);
      }}
    />
  );

  return { input, pick: () => inputRef.current?.click(), uploading, lines };
}

/** The refused files, one line each, under the upload button. */
export function UploadRefusals({ lines }: { lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return (
    <ul role="status" className="mb-4 flex flex-col gap-1 rounded-xl bg-secondary/60 px-4 py-3 text-[13px] leading-snug text-muted-foreground">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
