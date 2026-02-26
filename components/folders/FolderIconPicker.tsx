'use client';

import {
  Folder,
  Briefcase,
  BookOpen,
  FileText,
  Scale,
  Star,
  Heart,
  Archive,
  GraduationCap,
  Library,
  Bookmark,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/******************************************************************************
                               Constants
******************************************************************************/

const FOLDER_ICONS: { name: string; icon: LucideIcon }[] = [
  { name: 'folder', icon: Folder },
  { name: 'briefcase', icon: Briefcase },
  { name: 'book-open', icon: BookOpen },
  { name: 'file-text', icon: FileText },
  { name: 'scale', icon: Scale },
  { name: 'star', icon: Star },
  { name: 'heart', icon: Heart },
  { name: 'archive', icon: Archive },
  { name: 'graduation-cap', icon: GraduationCap },
  { name: 'library', icon: Library },
  { name: 'bookmark', icon: Bookmark },
  { name: 'lightbulb', icon: Lightbulb },
];

// Lookup map for rendering folder icons by name
const FOLDER_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  FOLDER_ICONS.map((item) => [item.name, item.icon])
);

/******************************************************************************
                               Components
******************************************************************************/

interface FolderIconPickerProps {
  value?: string;
  onChange: (icon: string) => void;
}

/**
 * Default component. Icon picker for folders using curated lucide icons.
 */
function FolderIconPicker({ value, onChange }: FolderIconPickerProps) {
  const ActiveIcon = value ? FOLDER_ICON_MAP[value] || Folder : Folder;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9">
          <ActiveIcon className="h-4 w-4" />
          <span className="sr-only">Pick an icon</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="grid grid-cols-4 gap-1.5">
          {FOLDER_ICONS.map(({ name, icon: Icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                value === name && 'bg-accent ring-1 ring-ring'
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Resolve a folder icon name to a lucide component.
 */
function getFolderIcon(name: string | null): LucideIcon {
  if (!name) return Folder;
  return FOLDER_ICON_MAP[name] || Folder;
}

/******************************************************************************
                               Export default
******************************************************************************/

export { FolderIconPicker, getFolderIcon, FOLDER_ICONS, FOLDER_ICON_MAP };
