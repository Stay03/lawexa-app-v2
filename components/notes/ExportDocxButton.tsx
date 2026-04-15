'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { notesApi } from '@/lib/api/notes';

interface ExportDocxButtonProps {
  slug: string;
}

function ExportDocxButton({ slug }: ExportDocxButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await notesApi.exportDocx(slug);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Note exported as DOCX');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        toast.error('You don\'t have access to export this note');
      } else {
        toast.error('Failed to export note');
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
      className="gap-1.5"
    >
      {exporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {exporting ? 'Exporting...' : 'Export'}
    </Button>
  );
}

export { ExportDocxButton };
