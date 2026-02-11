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
import { useJudges } from '@/lib/hooks/useAdminCases';
import { useDebounce } from '@/hooks/use-debounce';

/******************************************************************************
                                Component Props
******************************************************************************/

interface JudgeMultiSelectProps {
  value: number[];
  onValueChange: (value: number[]) => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Multi-select for judges
 * Only allows selection from existing judges (no custom values)
 */
export function JudgeMultiSelect({ value, onValueChange }: JudgeMultiSelectProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);

  // Fetch judge suggestions
  const { data: judgesData } = useJudges({
    search: debouncedSearch,
    per_page: 20,
  });

  const judges = judgesData?.data || [];

  // Filter out already selected judges
  const availableJudges = judges.filter((j) => !value.includes(j.id));

  // Get selected judge details (for display)
  const selectedJudges = judges.filter((j) => value.includes(j.id));

  // Add judge
  const handleAddJudge = (judgeId: number) => {
    if (!value.includes(judgeId)) {
      onValueChange([...value, judgeId]);
      setSearch('');
    }
  };

  // Remove judge
  const handleRemoveJudge = (judgeId: number) => {
    onValueChange(value.filter((id) => id !== judgeId));
  };

  return (
    <div className="space-y-2">
      {/* Selected Judges */}
      {selectedJudges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedJudges.map((judge) => (
            <Badge key={judge.id} variant="secondary" className="gap-1">
              {judge.name}
              <button
                type="button"
                onClick={() => handleRemoveJudge(judge.id)}
                className="ml-0.5 hover:text-destructive rounded-full"
                aria-label={`Remove ${judge.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search Input */}
      <Combobox
        value=""
        onValueChange={(newValue) => {
          if (newValue) {
            handleAddJudge(Number(newValue));
          }
        }}
      >
        <ComboboxInput
          placeholder={
            value.length > 0
              ? 'Add more judges...'
              : 'Search for judges...'
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <ComboboxContent>
          <ComboboxList>
            {/* Available judges */}
            {availableJudges.map((judge) => (
              <ComboboxItem
                key={judge.id}
                value={String(judge.id)}
                onSelect={() => handleAddJudge(judge.id)}
              >
                {judge.name}
              </ComboboxItem>
            ))}

            {/* Empty state */}
            {!availableJudges.length && (
              <ComboboxEmpty>
                {debouncedSearch
                  ? 'No judges found'
                  : 'Start typing to search judges...'}
              </ComboboxEmpty>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
