'use client';

import { useQuery } from '@tanstack/react-query';
import { MessageSquarePlus, PencilLine } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError } from '@/lib/utils/api-error';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { privateItemsQueries } from './queries';
import { TemplateDocument } from './TemplateDocument';
import { TemplateTags } from './TemplateTags';

/**
 * Preview: the document with its blanks marked, without downloading it
 * (Arthur's pages, 19 November 2026). Use in chat and Edit blanks are at its
 * foot, the two things a person does after reading it.
 */
export function TemplatePreview({
  uuid,
  open,
  onClose,
  onUse,
  onEditBlanks,
}: {
  uuid: string;
  open: boolean;
  onClose: () => void;
  onUse: () => void;
  onEditBlanks: () => void;
}) {
  const query = useQuery({ ...privateItemsQueries.template(uuid), enabled: open });
  const template = query.data;
  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      className="md:max-w-3xl"
      title={template?.name ?? 'Template'}
      description={
        template ? (
          <span className="flex flex-wrap items-center gap-2">
            <TemplateTags type={template.document_type} area={template.practice_area} />
            <span>
              {template.blanks.length} blanks · version {template.version}
            </span>
          </span>
        ) : undefined
      }
      footer={
        <>
          <Button variant="outline" onClick={onEditBlanks} disabled={!template}>
            <PencilLine aria-hidden className="size-4" />
            Edit blanks
          </Button>
          <Button onClick={onUse} disabled={!template}>
            <MessageSquarePlus aria-hidden className="size-4" />
            Use in chat
          </Button>
        </>
      }
    >
      {query.isPending ? (
        <Skeleton aria-hidden className="h-[28rem] rounded-xl" />
      ) : query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {extractApiError(query.error).message || 'The template did not load.'}
        </p>
      ) : (
        <TemplateDocument segments={query.data.segments} />
      )}
    </ResponsiveOverlay>
  );
}
