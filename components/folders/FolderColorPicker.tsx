'use client';

import { Check } from 'lucide-react';
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

const FOLDER_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
] as const;

/******************************************************************************
                               Components
******************************************************************************/

interface FolderColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
}

/**
 * Default component. Color swatch picker for folders.
 */
function FolderColorPicker({ value, onChange }: FolderColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-9 rounded-full p-0"
          style={{ backgroundColor: value || undefined }}
        >
          {!value && (
            <span className="text-xs text-muted-foreground">?</span>
          )}
          <span className="sr-only">Pick a color</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="grid grid-cols-5 gap-1.5">
          {FOLDER_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                value === color && 'ring-2 ring-ring ring-offset-2'
              )}
              style={{ backgroundColor: color }}
            >
              {value === color && (
                <Check className="h-3.5 w-3.5 text-white" />
              )}
            </button>
          ))}
        </div>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Remove color
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export { FolderColorPicker, FOLDER_COLORS };
