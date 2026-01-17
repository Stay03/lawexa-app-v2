import type { Note, NoteUser } from '@/types/note';
import type { User } from '@/types/auth';

/**
 * Format note price for display
 */
export function formatNotePrice(note: Note): string {
  if (note.is_free) {
    return 'Free';
  }

  const ngnPrice = parseFloat(note.price_ngn);
  const usdPrice = parseFloat(note.price_usd);

  if (ngnPrice > 0) {
    return `₦${ngnPrice.toLocaleString()}`;
  }

  if (usdPrice > 0) {
    return `$${usdPrice.toFixed(2)}`;
  }

  return 'Free';
}

/**
 * Get both prices for display
 */
export function getNotePrices(note: Note): { ngn: string; usd: string } | null {
  if (note.is_free) {
    return null;
  }

  const ngnPrice = parseFloat(note.price_ngn);
  const usdPrice = parseFloat(note.price_usd);

  return {
    ngn: ngnPrice > 0 ? `₦${ngnPrice.toLocaleString()}` : '',
    usd: usdPrice > 0 ? `$${usdPrice.toFixed(2)}` : '',
  };
}

/**
 * Check if user owns the note
 */
export function isNoteOwner(note: Note, user: User | null): boolean {
  if (!user) return false;
  return note.user.id === user.id;
}

/**
 * Check if user can edit the note
 */
export function canEditNote(note: Note, user: User | null): boolean {
  if (!user) return false;
  if (isNoteOwner(note, user)) return true;
  return user.role === 'admin';
}

/**
 * Check if user can delete the note
 */
export function canDeleteNote(note: Note, user: User | null): boolean {
  return canEditNote(note, user);
}

/**
 * Check if user can set prices on notes
 */
export function canSetPrice(user: User | null): boolean {
  if (!user) return false;
  return user.is_creator === true || user.role === 'admin';
}

/**
 * Get badge variant for note status
 */
export function getNoteStatusVariant(
  status: Note['status']
): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'published':
      return 'default';
    case 'draft':
      return 'secondary';
    default:
      return 'outline';
  }
}

/**
 * Get display text for note status
 */
export function getNoteStatusText(status: Note['status']): string {
  switch (status) {
    case 'published':
      return 'Published';
    case 'draft':
      return 'Draft';
    default:
      return status;
  }
}

/**
 * Format relative time for note dates
 */
export function formatNoteDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Generate note URL path
 */
export function getNoteUrl(note: Note): string {
  return `/notes/${note.slug}`;
}

/**
 * Generate note edit URL path
 */
export function getNoteEditUrl(note: Note): string {
  return `/notes/${note.slug}/edit`;
}
