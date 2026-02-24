'use client';

import { ExternalLink, FileText, Image, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import type { AdminLawyerDocument } from '@/types/admin-lawyer-verification';

interface LawyerVerificationDocumentCardProps {
  document: AdminLawyerDocument;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return FileText;
  if (mimeType.startsWith('image/')) return Image;
  return File;
}

/**
 * Card displaying a single verification document.
 * Shows file icon, name, size, upload date, and a view button.
 */
export function LawyerVerificationDocumentCard({
  document,
}: LawyerVerificationDocumentCardProps) {
  const Icon = getFileIcon(document.mime_type);

  return (
    <div className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/30">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" title={document.original_name}>
          {document.original_name}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{formatBytes(document.size)}</span>
          <span>&middot;</span>
          <span>{format(new Date(document.created_at), 'MMM d, yyyy')}</span>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        asChild
      >
        <a
          href={document.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          View
        </a>
      </Button>
    </div>
  );
}
