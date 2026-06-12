'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Gavel,
  Landmark,
  Plus,
  Scale,
  StickyNote,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { searchRadarEntities } from '@/lib/api/radar-entities';
import { useDebounce } from '@/lib/hooks/useDebounce';
import {
  RADAR_LIMITS,
  radarEntityTypeLabel,
} from '@/lib/utils/radar-validation';
import type { RadarEntityOption, RadarEntityType } from '@/types/radar';

const ENTITY_TYPE_ICONS: Record<RadarEntityType, LucideIcon> = {
  case: Scale,
  statute: BookOpen,
  court: Landmark,
  judge: Gavel,
  note: StickyNote,
};

const ENTITY_TYPES: RadarEntityType[] = [
  'case',
  'statute',
  'court',
  'judge',
  'note',
];

const MIN_SEARCH_LENGTH = 2;

interface EntityPickerProps {
  value: RadarEntityOption[];
  onChange: (value: RadarEntityOption[]) => void;
}

/**
 * Watch specific Lawexa records: pick an entity type, search it, and pin
 * matches as chips. Stored entities without labels render as "Type #id".
 */
function EntityPicker({ value, onChange }: EntityPickerProps) {
  const [adding, setAdding] = useState(false);
  const [entityType, setEntityType] = useState<RadarEntityType>('case');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);

  const atCapacity = value.length >= RADAR_LIMITS.entities;
  const searchEnabled = debouncedSearch.length >= MIN_SEARCH_LENGTH && !atCapacity;

  const { data: results, isFetching } = useQuery({
    queryKey: ['radar-entity-search', entityType, debouncedSearch],
    queryFn: () => searchRadarEntities(entityType, debouncedSearch),
    enabled: searchEnabled,
    staleTime: 60 * 1000,
  });

  const isSelected = (option: RadarEntityOption) =>
    value.some(
      (entity) =>
        entity.entity_type === option.entity_type &&
        entity.entity_id === option.entity_id
    );
  const available = (results ?? []).filter((option) => !isSelected(option));

  const addEntity = (option: RadarEntityOption) => {
    if (!isSelected(option) && !atCapacity) {
      onChange([...value, option]);
    }
    setSearch('');
    setAdding(false);
  };

  const removeEntity = (entity: RadarEntityOption) => {
    onChange(
      value.filter(
        (existing) =>
          existing.entity_type !== entity.entity_type ||
          existing.entity_id !== entity.entity_id
      )
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {value.map((entity) => {
          const Icon = ENTITY_TYPE_ICONS[entity.entity_type];
          return (
            <Badge
              key={`${entity.entity_type}-${entity.entity_id}`}
              variant="secondary"
              className="gap-1"
            >
              <Icon />
              {entity.label}
              <button
                type="button"
                onClick={() => removeEntity(entity)}
                className="ml-0.5 rounded-full hover:text-destructive"
                aria-label={`Remove ${entity.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}

        {!adding && !atCapacity && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="size-3" />
            Add entity
          </button>
        )}

        {atCapacity && (
          <span className="text-xs text-muted-foreground">
            Limit of {RADAR_LIMITS.entities} reached
          </span>
        )}
      </div>

      {adding && !atCapacity && (
        <div className="flex gap-2">
          <Select
            value={entityType}
            onValueChange={(type) => {
              setEntityType(type as RadarEntityType);
              setSearch('');
            }}
          >
            <SelectTrigger className="w-32 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {radarEntityTypeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Combobox
            value=""
            onValueChange={(selected) => {
              if (typeof selected !== 'string' || !selected) return;
              const option = available.find(
                (candidate) => String(candidate.entity_id) === selected
              );
              if (option) addEntity(option);
            }}
          >
            <ComboboxInput
              autoFocus
              className="flex-1"
              placeholder={`Search ${radarEntityTypeLabel(entityType).toLowerCase()}s…`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSearch('');
                  setAdding(false);
                }
              }}
            />
            <ComboboxContent>
              <ComboboxList>
                {available.map((option) => (
                  <ComboboxItem
                    key={option.entity_id}
                    value={String(option.entity_id)}
                  >
                    <span className="truncate">{option.label}</span>
                    {option.sublabel && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {option.sublabel}
                      </span>
                    )}
                  </ComboboxItem>
                ))}
                {available.length === 0 && (
                  <ComboboxEmpty>
                    {debouncedSearch.length < MIN_SEARCH_LENGTH
                      ? 'Type at least 2 characters to search'
                      : isFetching
                        ? 'Searching…'
                        : `No ${radarEntityTypeLabel(entityType).toLowerCase()}s found`}
                  </ComboboxEmpty>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      )}
    </div>
  );
}

export { EntityPicker };
