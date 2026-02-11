'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { useCaseTags } from '@/lib/hooks/useAdminCases';
import { useDebounce } from '@/lib/hooks/useDebounce';

/******************************************************************************
                                Component Props
******************************************************************************/

interface TagsMultiSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Multi-select with badges for case tags
 * Allows selecting existing tags or creating new ones
 */
export function TagsMultiSelect({ value, onValueChange }: TagsMultiSelectProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);

  // Fetch tag suggestions
  const { data: tagsData } = useCaseTags(debouncedSearch);
  const tags = tagsData?.data || [];

  // Filter out already selected tags
  const availableTags = tags.filter((tag) => !value.includes(tag));

  // Add tag
  const handleAddTag = (tag: string) => {
    const normalizedTag = tag.toUpperCase().trim();
    if (!value.includes(normalizedTag) && normalizedTag) {
      onValueChange([...value, normalizedTag]);
      setSearch('');
    }
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    onValueChange(value.filter((tag) => tag !== tagToRemove));
  };

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      e.preventDefault();
      handleAddTag(search);
    } else if (e.key === 'Backspace' && !search && value.length > 0) {
      // Remove last tag on backspace if input is empty
      handleRemoveTag(value[value.length - 1]);
    }
  };

  // Handle paste (comma-separated tags)
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText.includes(',') || pastedText.includes(';')) {
      e.preventDefault();
      const newTags = pastedText
        .split(/[,;]/)
        .map((tag) => tag.trim().toUpperCase())
        .filter((tag) => tag && !value.includes(tag));
      if (newTags.length > 0) {
        onValueChange([...value, ...newTags]);
        setSearch('');
      }
    }
  };

  const showCreateOption = search && !tags.some(t => t.toUpperCase() === search.toUpperCase());

  return (
    <div className="space-y-2">
      {/* Selected Tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="ml-0.5 hover:text-destructive rounded-full"
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input and Dropdown */}
      <Combobox
        value=""
        onValueChange={(newValue) => {
          if (newValue) {
            handleAddTag(newValue);
          }
        }}
      >
        <ComboboxInput
          placeholder={value.length > 0 ? "Add more tags..." : "Type to search or create tags..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />

        <ComboboxContent>
          <ComboboxList>
            {/* Existing tags */}
            {availableTags.map((tag) => (
              <ComboboxItem
                key={tag}
                value={tag}
                onSelect={() => handleAddTag(tag)}
              >
                {tag}
              </ComboboxItem>
            ))}

            {/* Create new option */}
            {showCreateOption && (
              <ComboboxItem
                value={search.toUpperCase()}
                onSelect={() => handleAddTag(search)}
                className="text-primary border-t"
              >
                <span className="text-xs">Create:</span>{' '}
                <span className="font-medium">{search.toUpperCase()}</span>
              </ComboboxItem>
            )}

            {/* Empty state */}
            {!availableTags.length && !showCreateOption && (
              <ComboboxEmpty>
                {debouncedSearch
                  ? 'No tags found. Press Enter to create.'
                  : 'Start typing to search or create tags...'}
              </ComboboxEmpty>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        Press Enter or comma to add. Paste comma-separated tags.
      </p>
    </div>
  );
}
