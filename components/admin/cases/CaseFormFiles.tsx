'use client';

import { useRef, useState } from 'react';
import { FileText, Image, Upload, X, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useCaseFiles,
  useUploadCaseFile,
  useDeleteCaseFile,
} from '@/lib/hooks/useAdminCases';
import {
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE,
  MAX_FILES_PER_CASE,
} from '@/types/admin-cases';
import { formatFileSize, getFileTypeIcon } from '@/lib/validations/admin-cases';

/******************************************************************************
                                Component Props
******************************************************************************/

interface CaseFormFilesProps {
  caseId: number;
}

/******************************************************************************
                                Helper Functions
******************************************************************************/

/**
 * Validate a file before upload
 */
function validateFile(file: File): string | null {
  if (!ACCEPTED_FILE_TYPES.includes(file.type as any)) {
    return `${file.name}: File type not supported. Please upload PDF, DOC, DOCX, TXT, RTF, JPG, PNG, GIF, or WebP files.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `${file.name}: File exceeds 20MB limit (${formatFileSize(file.size)})`;
  }
  return null;
}

/**
 * Get appropriate icon component for file type
 */
function FileIcon({ mimeType }: { mimeType: string }) {
  const iconName = getFileTypeIcon(mimeType);

  if (iconName === 'image') {
    return <Image className="h-5 w-5 text-purple-500" />;
  }
  return <FileText className="h-5 w-5 text-blue-500" />;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * File upload and management section
 * Supports drag-and-drop, displays existing files, allows delete
 */
export function CaseFormFiles({ caseId }: CaseFormFilesProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Queries and mutations
  const { data: filesData, isLoading } = useCaseFiles(caseId);
  const uploadMutation = useUploadCaseFile();
  const deleteMutation = useDeleteCaseFile();

  const files = filesData?.data || [];
  const canUploadMore = files.length < MAX_FILES_PER_CASE;

  // Handle file selection
  const handleFiles = (selectedFiles: File[]) => {
    if (!canUploadMore) {
      toast.error(`Maximum of ${MAX_FILES_PER_CASE} files per case`);
      return;
    }

    const remainingSlots = MAX_FILES_PER_CASE - files.length;
    const filesToUpload = selectedFiles.slice(0, remainingSlots);

    filesToUpload.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }

      // Upload immediately
      uploadMutation.mutate(
        { caseId, file },
        {
          onSuccess: (response) => {
            toast.success(`${file.name} uploaded successfully`);
          },
          onError: (error: any) => {
            const message =
              error?.response?.data?.message || 'Failed to upload file';
            toast.error(`${file.name}: ${message}`);
          },
        }
      );
    });
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  // File input change handler
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
      // Reset input
      e.target.value = '';
    }
  };

  // Delete handler
  const handleDelete = (fileId: number, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    deleteMutation.mutate(
      { fileId, caseId },
      {
        onSuccess: () => {
          toast.success(`${fileName} deleted successfully`);
        },
        onError: () => {
          toast.error(`Failed to delete ${fileName}`);
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      {canUploadMore && (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          )}
        >
          <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-sm font-medium mb-1">
            Choose files or drag and drop
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            PDF, DOC, DOCX, TXT, RTF, JPG, PNG, GIF, WebP
            <br />
            Max 20MB per file, {MAX_FILES_PER_CASE - files.length} slots
            remaining
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              'Select Files'
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES.join(',')}
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      )}

      {/* File Counter */}
      {files.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {files.length} / {MAX_FILES_PER_CASE} files uploaded
        </p>
      )}

      {/* Existing Files List */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              <FileIcon mimeType={file.mime_type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {file.original_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => window.open(file.url, '_blank')}
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(file.id, file.original_name)}
                  disabled={deleteMutation.isPending}
                  title="Delete"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && files.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No files uploaded yet
        </p>
      )}
    </div>
  );
}
