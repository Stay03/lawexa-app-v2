import type { LucideIcon } from 'lucide-react';
import {
  UserPlus,
  LogIn,
  LogOut,
  UserCircle,
  KeyRound,
  Ban,
  MessageSquare,
  MessageSquarePlus,
  MessageSquareOff,
  Eye,
  Send,
  FileSearch,
  Scroll,
  NotebookText,
  NotebookPen,
  FileCheck2,
  FileX2,
  Trash2,
  Undo2,
  FolderPlus,
  Folder,
  FolderOpen,
  FolderMinus,
  FilePlus2,
  FileMinus2,
  Inbox,
  CreditCard,
  XCircle,
  ShoppingBag,
  FileDown,
  Bookmark,
  BookmarkMinus,
  Activity,
  Pencil,
} from 'lucide-react';

export type ActivityCategory =
  | 'auth'
  | 'ai'
  | 'content_view'
  | 'content_create'
  | 'commerce'
  | 'export'
  | 'other';

interface ActionMeta {
  label: string;
  icon: LucideIcon;
  category: ActivityCategory;
  tone: 'success' | 'info' | 'warn' | 'danger' | 'muted';
}

const META: Record<string, ActionMeta> = {
  user_registered: { label: 'Registered', icon: UserPlus, category: 'auth', tone: 'success' },
  user_logged_in: { label: 'Logged in', icon: LogIn, category: 'auth', tone: 'info' },
  user_logged_out: { label: 'Logged out', icon: LogOut, category: 'auth', tone: 'muted' },
  guest_created: { label: 'Guest created', icon: UserCircle, category: 'auth', tone: 'muted' },
  google_login_succeeded: { label: 'Google login', icon: LogIn, category: 'auth', tone: 'info' },
  login_failed: { label: 'Login failed', icon: Ban, category: 'auth', tone: 'danger' },
  password_reset_requested: { label: 'Password reset requested', icon: KeyRound, category: 'auth', tone: 'warn' },
  password_reset_completed: { label: 'Password reset', icon: KeyRound, category: 'auth', tone: 'success' },

  conversation_created: { label: 'Conversation started', icon: MessageSquarePlus, category: 'ai', tone: 'info' },
  conversation_viewed: { label: 'Viewed conversation', icon: Eye, category: 'ai', tone: 'muted' },
  conversation_published: { label: 'Conversation published', icon: MessageSquare, category: 'ai', tone: 'success' },
  conversation_deleted: { label: 'Conversation deleted', icon: MessageSquareOff, category: 'ai', tone: 'danger' },
  ai_message_sent: { label: 'AI message sent', icon: Send, category: 'ai', tone: 'info' },

  case_viewed: { label: 'Viewed case', icon: FileSearch, category: 'content_view', tone: 'muted' },
  statute_viewed: { label: 'Viewed statute', icon: Scroll, category: 'content_view', tone: 'muted' },
  note_viewed: { label: 'Viewed note', icon: NotebookText, category: 'content_view', tone: 'muted' },
  folder_viewed: { label: 'Viewed folder', icon: FolderOpen, category: 'content_view', tone: 'muted' },

  note_created: { label: 'Note created', icon: NotebookPen, category: 'content_create', tone: 'info' },
  note_published: { label: 'Note published', icon: FileCheck2, category: 'content_create', tone: 'success' },
  note_unpublished: { label: 'Note unpublished', icon: FileX2, category: 'content_create', tone: 'warn' },
  note_deleted: { label: 'Note deleted', icon: Trash2, category: 'content_create', tone: 'danger' },
  note_restored: { label: 'Note restored', icon: Undo2, category: 'content_create', tone: 'success' },

  folder_created: { label: 'Folder created', icon: FolderPlus, category: 'content_create', tone: 'info' },
  folder_updated: { label: 'Folder updated', icon: Pencil, category: 'content_create', tone: 'muted' },
  folder_deleted: { label: 'Folder deleted', icon: FolderMinus, category: 'content_create', tone: 'danger' },
  folder_restored: { label: 'Folder restored', icon: Folder, category: 'content_create', tone: 'success' },
  folder_item_added: { label: 'Added to folder', icon: FilePlus2, category: 'content_create', tone: 'info' },
  folder_item_removed: { label: 'Removed from folder', icon: FileMinus2, category: 'content_create', tone: 'warn' },

  content_requested: { label: 'Content requested', icon: Inbox, category: 'content_create', tone: 'warn' },

  case_deleted: { label: 'Case deleted', icon: Trash2, category: 'content_create', tone: 'danger' },
  case_restored: { label: 'Case restored', icon: Undo2, category: 'content_create', tone: 'success' },

  bookmark_added: { label: 'Bookmarked', icon: Bookmark, category: 'content_create', tone: 'info' },
  bookmark_removed: { label: 'Removed bookmark', icon: BookmarkMinus, category: 'content_create', tone: 'muted' },

  subscription_started: { label: 'Subscription started', icon: CreditCard, category: 'commerce', tone: 'success' },
  subscription_cancelled: { label: 'Subscription cancelled', icon: XCircle, category: 'commerce', tone: 'warn' },
  message_pack_purchased: { label: 'Message pack purchased', icon: ShoppingBag, category: 'commerce', tone: 'success' },

  note_exported: { label: 'Note exported', icon: FileDown, category: 'export', tone: 'muted' },
  case_exported: { label: 'Case exported', icon: FileDown, category: 'export', tone: 'muted' },
};

const FALLBACK: ActionMeta = {
  label: '',
  icon: Activity,
  category: 'other',
  tone: 'muted',
};

export function getActionMeta(action: string): ActionMeta {
  const hit = META[action];
  if (hit) return hit;
  return {
    ...FALLBACK,
    label: action.replace(/_/g, ' '),
  };
}

export const TONE_CLASS: Record<ActionMeta['tone'], string> = {
  success: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950',
  info: 'text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-950',
  warn: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950',
  danger: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950',
  muted: 'text-muted-foreground bg-muted',
};

export const ACTION_GROUPS: { label: string; actions: string[] }[] = [
  {
    label: 'Auth',
    actions: [
      'user_registered',
      'user_logged_in',
      'user_logged_out',
      'guest_created',
      'google_login_succeeded',
      'login_failed',
      'password_reset_requested',
      'password_reset_completed',
    ],
  },
  {
    label: 'AI',
    actions: [
      'conversation_created',
      'conversation_viewed',
      'conversation_published',
      'conversation_deleted',
      'ai_message_sent',
    ],
  },
  {
    label: 'Content views',
    actions: ['case_viewed', 'statute_viewed', 'note_viewed', 'folder_viewed'],
  },
  {
    label: 'Notes',
    actions: [
      'note_created',
      'note_published',
      'note_unpublished',
      'note_deleted',
      'note_restored',
    ],
  },
  {
    label: 'Folders',
    actions: [
      'folder_created',
      'folder_updated',
      'folder_deleted',
      'folder_restored',
      'folder_item_added',
      'folder_item_removed',
    ],
  },
  {
    label: 'Cases',
    actions: ['case_deleted', 'case_restored'],
  },
  {
    label: 'Bookmarks',
    actions: ['bookmark_added', 'bookmark_removed'],
  },
  {
    label: 'Content requests',
    actions: ['content_requested'],
  },
  {
    label: 'Commerce',
    actions: [
      'subscription_started',
      'subscription_cancelled',
      'message_pack_purchased',
    ],
  },
  {
    label: 'Export',
    actions: ['note_exported', 'case_exported'],
  },
];
