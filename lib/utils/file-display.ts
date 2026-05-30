import { File, FileText, Image as ImageIcon } from 'lucide-react';

type LucideIcon = typeof File;

/**
 * Format bytes as a human-readable size (e.g. "12 KB", "3.4 MB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(size < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Pick a lucide icon component for a file mime type.
 */
export function getFileIcon(mimeType: string): LucideIcon {
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType === 'application/pdf') return FileText;
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/rtf'
  ) return FileText;
  return File;
}

/**
 * Short uppercase extension label for a mime type (e.g. "DOCX", "PDF").
 * Falls back to "FILE" for unmapped mime types.
 */
export function getFileExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'image/webp': 'WEBP',
    'application/pdf': 'PDF',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/rtf': 'RTF',
  };
  return map[mimeType] || 'FILE';
}
