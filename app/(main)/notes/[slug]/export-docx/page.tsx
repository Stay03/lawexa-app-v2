'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { notesApi } from '@/lib/api/notes';
import { useAuthStore } from '@/lib/stores/authStore';

interface ExportDocxPageProps {
  params: Promise<{ slug: string }>;
}

export default function ExportDocxPage({ params }: ExportDocxPageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const { token } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;

    if (!token) {
      router.replace('/login');
      return;
    }

    const download = async () => {
      try {
        const blob = await notesApi.exportDocx(slug);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slug}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Note exported as DOCX');
        router.replace(`/notes/${slug}`);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          toast.error('Please log in to export notes');
          router.replace('/login');
        } else if (status === 403) {
          toast.error('You don\'t have access to export this note');
          router.replace(`/notes/${slug}`);
        } else if (status === 404) {
          toast.error('Note not found');
          router.replace('/notes');
        } else {
          setError('Failed to export note. Please try again.');
          toast.error('Failed to export note');
        }
      }
    };

    download();
  }, [slug, token, router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      {error ? (
        <>
          <FileDown className="text-muted-foreground h-10 w-10" />
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => router.replace(`/notes/${slug}`)}
            className="text-primary text-sm underline"
          >
            Back to note
          </button>
        </>
      ) : (
        <>
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Preparing download...</p>
        </>
      )}
    </div>
  );
}
