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
        <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-lg">
          <FileText className="text-primary size-[18px]" />
        </div>

        <div className="min-w-0 flex-1">
          <a
            href={note.url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-1 text-sm font-medium hover:underline"
          >
            {note.title}
          </a>
          <p className="text-muted-foreground mt-0.5 text-xs">Saved to your notes</p>
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
