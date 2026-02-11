'use client';

import { useState } from 'react';
import { X, FileText, CheckCircle2, Quote } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { useCases } from '@/lib/hooks/useAdminCases';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { cn } from '@/lib/utils';

/******************************************************************************
                                Component Props
******************************************************************************/

interface CaseMultiSelectProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  excludeCaseId?: number;
  placeholder?: string;
  emptyText?: string;
  variant?: 'similar' | 'cited';
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Multi-select for case relationships (similar or cited cases)
 * Only allows selection from existing cases (no custom values)
 */
export function CaseMultiSelect({
  value,
  onValueChange,
  excludeCaseId,
  placeholder = 'Search cases...',
  emptyText = 'No cases found',
  variant = 'similar',
}: CaseMultiSelectProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);

  // Fetch case suggestions
  const { data: casesData } = useCases({
    search: debouncedSearch,
    per_page: 20,
  });

  const cases = casesData?.data || [];

  // Filter out already selected and current case
  const availableCases = cases.filter(
    (c) => !value.includes(c.id) && c.id !== excludeCaseId
  );

  // Get selected case details (for display)
  const selectedCases = cases.filter((c) => value.includes(c.id));

  // Add case
  const handleAddCase = (caseId: number) => {
    if (!value.includes(caseId) && value.length < 50) {
      onValueChange([...value, caseId]);
      setSearch('');
    }
  };

  // Remove case
  const handleRemoveCase = (caseId: number) => {
    onValueChange(value.filter((id) => id !== caseId));
  };

  const icon = variant === 'cited' ? Quote : CheckCircle2;
  const Icon = icon;

  return (
    <div className="space-y-3">
      {/* Selected Cases */}
      {selectedCases.length > 0 && (
        <div className="space-y-2">
          {selectedCases.map((caseItem) => (
            <div
              key={caseItem.id}
              className={cn(
                'flex items-start gap-2 p-3 rounded-lg border bg-card',
                variant === 'cited' && 'border-primary/20 bg-primary/5'
              )}
            >
              <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">
                  {caseItem.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {caseItem.court && `${caseItem.court} • `}
                  {caseItem.judgment_date || 'No date'}
                  {caseItem.citation && ` • ${caseItem.citation}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveCase(caseItem.id)}
                className="shrink-0 hover:text-destructive rounded-full p-1"
                aria-label={`Remove ${caseItem.title}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search Input */}
      <Combobox
        value=""
        onValueChange={(newValue) => {
          if (newValue) {
            handleAddCase(Number(newValue));
          }
        }}
      >
        <ComboboxInput
          placeholder={
            value.length >= 50
              ? 'Maximum 50 cases reached'
              : value.length > 0
              ? 'Add more cases...'
              : placeholder
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={value.length >= 50}
        />

        <ComboboxContent>
          <ComboboxList>
            {/* Available cases */}
            {availableCases.map((caseItem) => (
              <ComboboxItem
                key={caseItem.id}
                value={String(caseItem.id)}
                onSelect={() => handleAddCase(caseItem.id)}
                className="flex items-start gap-2 py-2"
              >
                <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">
                    {caseItem.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {caseItem.court && `${caseItem.court} • `}
                    {caseItem.judgment_date || 'No date'}
                  </p>
                </div>
              </ComboboxItem>
            ))}

            {/* Empty state */}
            {!availableCases.length && (
              <ComboboxEmpty>
                {debouncedSearch ? emptyText : 'Start typing to search cases...'}
              </ComboboxEmpty>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {/* Counter */}
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {value.length} / 50 cases selected
        </p>
      )}
    </div>
  );
}
