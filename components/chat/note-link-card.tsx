'use client';

import { FileText, Download, ExternalLink } from 'lucide-react';

import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { NoteLinkInfo } from '@/lib/utils/parse-content-xml';

interface NoteLinkCardProps {
  note: NoteLinkInfo;
}

export function NoteLinkCard({ note }: NoteLinkCardProps) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3 py-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <FileText className="size-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <a
            href={note.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium hover:underline line-clamp-1"
          >
            {note.title}
          </a>
          <p className="text-xs text-muted-foreground mt-0.5">Saved to your notes</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            asChild
          >
            <a href={note.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              View
            </a>
          </Button>
          {note.downloadUrl && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              asChild
            >
              <a href={note.downloadUrl} target="_blank" rel="noopener noreferrer">
                <Download className="size-3.5" />
                DOCX
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
