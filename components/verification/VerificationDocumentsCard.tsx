'use client';

import { useState } from 'react';
import {
  Upload,
  Trash2,
  Loader2,
  ExternalLink,
  FileText,
  Image,
  File,
  Send,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  useUploadDocument,
  useDeleteDocument,
  useSubmitVerification,
} from '@/lib/hooks/useLawyerVerification';
import { extractApiError } from '@/lib/utils/api-error';
import type { LawyerProfile } from '@/lib/api/lawyerVerification';

interface VerificationDocumentsCardProps {
  profile: LawyerProfile;
}

function getFileIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return FileText;
  if (mimeType.startsWith('image/')) return Image;
  return File;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const REQUIRED_DOCUMENT_COUNT = 4;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

export function VerificationDocumentsCard({ profile }: VerificationDocumentsCardProps) {
  const { documents, can_resubmit } = profile;
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();
  const submitMutation = useSubmitVerification();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size must not exceed 10 MB');
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Only PDF, JPG, JPEG, and PNG files are allowed');
      return;
    }

    try {
      await uploadMutation.mutateAsync(file);
      toast.success('Document uploaded successfully');
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error(apiError.message);
    }
  };

  const handleDelete = async (docId: number) => {
    setDeletingId(docId);
    try {
      await deleteMutation.mutateAsync(docId);
      toast.success('Document removed successfully');
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error(apiError.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleResubmit = async () => {
    if (documents.length !== REQUIRED_DOCUMENT_COUNT) {
      const missing = REQUIRED_DOCUMENT_COUNT - documents.length;
      toast.error(
        `Please upload all ${REQUIRED_DOCUMENT_COUNT} required documents (${missing} remaining)`
      );
      return;
    }

    try {
      await submitMutation.mutateAsync();
      toast.success('Verification resubmitted successfully');
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error(apiError.message);
    }
  };

  const canUploadMore = can_resubmit && documents.length < REQUIRED_DOCUMENT_COUNT;
  const canSubmit = can_resubmit && documents.length === REQUIRED_DOCUMENT_COUNT;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            Documents
            <span className="text-sm font-normal text-muted-foreground">
              ({documents.length}/{REQUIRED_DOCUMENT_COUNT})
            </span>
          </span>

          {canUploadMore && (
            <Button
              variant="outline"
              size="sm"
              disabled={uploadMutation.isPending}
              asChild
            >
              <label className="cursor-pointer">
                {uploadMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-4 w-4" />
                )}
                Upload
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  disabled={uploadMutation.isPending}
                />
              </label>
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No documents uploaded
          </p>
        ) : (
          documents.map((doc) => {
            const Icon = getFileIcon(doc.mime_type);
            const isDeleting = deletingId === doc.id;

            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    title={doc.original_name}
                  >
                    {doc.original_name}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(doc.size)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      View
                    </a>
                  </Button>
                  {can_resubmit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(doc.id)}
                      disabled={isDeleting}
                      className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {can_resubmit && (
          <div className="pt-2">
            <Button
              onClick={handleResubmit}
              disabled={!canSubmit || submitMutation.isPending}
              className="w-full"
            >
              {submitMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Resubmit for Verification
            </Button>
            {!canSubmit && documents.length < REQUIRED_DOCUMENT_COUNT && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Upload{' '}
                {REQUIRED_DOCUMENT_COUNT - documents.length} more document
                {REQUIRED_DOCUMENT_COUNT - documents.length !== 1 ? 's' : ''} to
                resubmit
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
