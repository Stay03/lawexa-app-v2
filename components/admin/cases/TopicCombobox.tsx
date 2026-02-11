'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { cn } from '@/lib/utils';
import { useCaseTopics } from '@/lib/hooks/useAdminCases';
import { useDebounce } from '@/lib/hooks/useDebounce';

/******************************************************************************
                                Component Props
******************************************************************************/

interface TopicComboboxProps {
  value: string | null | undefined;
  onValueChange: (value: string | null) => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Single-select autocomplete for case topics
 * Allows free-text input or selection from existing topics
 */
export function TopicCombobox({ value, onValueChange }: TopicComboboxProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);

  // Fetch topic suggestions
  const { data: topicsData } = useCaseTopics(debouncedSearch);
  const topics = topicsData?.data || [];

  // Check if current value exists in suggestions
  const currentValue = value || '';
  const exactMatch = topics.includes(currentValue);
  const showCreateOption = search && !topics.includes(search) && search !== currentValue;

  return (
    <Combobox
      value={currentValue}
      onValueChange={(newValue) => {
        onValueChange(newValue || null);
        setSearch('');
      }}
    >
      <ComboboxInput
        placeholder="Search or enter a topic..."
        value={search || currentValue}
        onChange={(e) => setSearch(e.target.value)}
        onBlur={() => {
          // If user typed something but didn't select, use it as the value
          if (search && search !== value) {
            onValueChange(search);
          }
          setSearch('');
        }}
      />

      <ComboboxContent>
        <ComboboxList>
          {/* Existing topics */}
          {topics.map((topic) => (
            <ComboboxItem
              key={topic}
              value={topic}
              className="flex items-center gap-2"
            >
              <Check
                className={cn(
                  'h-4 w-4',
                  value === topic ? 'opacity-100' : 'opacity-0'
                )}
              />
              {topic}
            </ComboboxItem>
          ))}

          {/* Create new option */}
          {showCreateOption && (
            <ComboboxItem
              value={search}
              className="flex items-center gap-2 text-primary"
            >
              <span className="text-xs">Create:</span>
              <span className="font-medium">{search}</span>
            </ComboboxItem>
          )}

          {/* Empty state */}
          {!topics.length && !showCreateOption && (
            <ComboboxEmpty>
              {debouncedSearch
                ? 'No topics found. Type to create a new one.'
                : 'Start typing to search topics...'}
            </ComboboxEmpty>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
