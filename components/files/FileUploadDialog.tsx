'use client';

import { useState, useCallback } from 'react';
import { Upload, ImageIcon, FileText, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { FileUpload, FileUploadTrigger } from '@/components/ui/file-upload';
import { useUploadImage, useUploadDocument } from '@/lib/hooks/useFiles';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.rtf';
const IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const DOCUMENT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

const TABS = [
  { value: 'image', label: 'Image', icon: <ImageIcon className="h-3.5 w-3.5" /> },
  { value: 'document', label: 'Document', icon: <FileText className="h-3.5 w-3.5" /> },
];

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FileUploadDialog({ open, onOpenChange }: FileUploadDialogProps) {
  const [activeTab, setActiveTab] = useState<'image' | 'document'>('image');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const uploadImage = useUploadImage();
  const uploadDocument = useUploadDocument();

  const isUploading = uploadImage.isPending || uploadDocument.isPending;
  const isImage = activeTab === 'image';
  const maxSize = isImage ? IMAGE_MAX_SIZE : DOCUMENT_MAX_SIZE;
  const accept = isImage ? IMAGE_ACCEPT : DOCUMENT_ACCEPT;

  const validateFile = useCallback(
    (file: File): boolean => {
      if (file.size > maxSize) {
        toast.error(
          `File too large. Maximum size is ${isImage ? '5MB' : '10MB'}.`
        );
        return false;
      }
      return true;
    },
    [maxSize, isImage]
  );

  const handleFilesAdded = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      if (!validateFile(file)) return;
      setSelectedFile(file);
    },
    [validateFile]
  );

  const handleUpload = () => {
    if (!selectedFile) return;

    const mutation = isImage ? uploadImage : uploadDocument;
    mutation.mutate(selectedFile, {
      onSuccess: () => {
        setSelectedFile(null);
        onOpenChange(false);
      },
    });
  };

  const handleOpenChange = (value: boolean) => {
    if (!isUploading) {
      if (!value) setSelectedFile(null);
      onOpenChange(value);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
          <DialogDescription>
            Upload an image or document to your files.
          </DialogDescription>
        </DialogHeader>

        <AnimatedTabs
          tabs={TABS}
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as 'image' | 'document');
            setSelectedFile(null);
          }}
        />

        <div className="mt-2 space-y-4">
          {/* Drop zone */}
          <FileUpload
            onFilesAdded={handleFilesAdded}
            multiple={false}
            accept={accept}
            disabled={isUploading}
          >
            <FileUploadTrigger asChild>
              <div className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 px-6 py-8 transition-colors hover:border-muted-foreground/40 hover:bg-muted/50">
                <div className="rounded-full bg-background p-3 shadow-sm">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">
                    Click to browse or drag and drop
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isImage
                      ? 'JPG, PNG, GIF, WEBP — Max 5MB'
                      : 'PDF, DOC, DOCX, RTF — Max 10MB'}
                  </p>
                </div>
              </div>
            </FileUploadTrigger>
          </FileUpload>

          {/* Selected file preview */}
          {selectedFile && (
            <div className="flex items-center gap-3 overflow-hidden rounded-lg border bg-muted/30 p-3">
              <div className="rounded-lg bg-background p-2 shadow-sm">
                {isImage ? (
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(selectedFile.size)}
                </p>
              </div>
              {!isUploading && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* Upload button */}
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload {isImage ? 'Image' : 'Document'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
