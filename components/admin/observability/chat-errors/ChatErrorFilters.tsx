'use client';

import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EnumFilterSelect } from '@/components/admin/observability';
import { chatErrorStageMeta } from './chat-error-stage';
import {
  CHAT_ERROR_SOURCES,
  CHAT_ERROR_STAGES,
  hasChatErrorFilters,
  isChatErrorSource,
  isChatErrorStage,
  readChatErrorFilters,
  type ChatErrorsFilters,
  type ChatErrorsParams,
} from '@/types/admin-chat-errors';

interface ChatErrorFiltersProps {
  params: ChatErrorsParams;
  onParamsChange: (updates: Partial<ChatErrorsParams>) => void;
}

const CLEARED: ChatErrorsFilters = {
  stage: undefined,
  source: undefined,
  code: undefined,
  user_id: undefined,
  space_id: undefined,
  from: undefined,
  to: undefined,
};

export function ChatErrorFilters({ params, onParamsChange }: ChatErrorFiltersProps) {
  /* The typed fields apply on Enter or Apply, so a half-typed id is never a
     request, and a text box is never bound to the URL (lib/utils/url-params.ts
     says why it cannot be). Their defaults come from the URL; the key remounts
     them when the URL's copy of them changes (Back, Clear, Apply), and leaves
     what is being typed alone when a select changes. */
  const typedKey = [params.code, params.user_id, params.space_id, params.from, params.to]
    .map((value) => value ?? '')
    .join('|');

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const typed = readChatErrorFilters((key) => {
      const value = form.get(key);
      return typeof value === 'string' ? value : null;
    });
    onParamsChange({
      code: typed.code,
      user_id: typed.user_id,
      space_id: typed.space_id,
      from: typed.from,
      to: typed.to,
      page: 1,
    });
  };

  return (
    <form key={typedKey} onSubmit={apply} className="flex flex-wrap items-center gap-2">
      <EnumFilterSelect
        value={params.stage}
        options={CHAT_ERROR_STAGES}
        onChange={(v) =>
          onParamsChange({ stage: v !== undefined && isChatErrorStage(v) ? v : undefined, page: 1 })
        }
        placeholder="Stage"
        allLabel="All stages"
        className="w-[150px]"
        labelFor={(v) => chatErrorStageMeta(v).label}
      />
      <EnumFilterSelect
        value={params.source}
        options={CHAT_ERROR_SOURCES}
        onChange={(v) =>
          onParamsChange({ source: v !== undefined && isChatErrorSource(v) ? v : undefined, page: 1 })
        }
        placeholder="Source"
        allLabel="Both sources"
        className="w-[140px]"
      />
      <Input
        name="code"
        defaultValue={params.code ?? ''}
        placeholder="Code"
        aria-label="Error code"
        className="h-9 w-[160px]"
      />
      <Input
        name="user_id"
        type="number"
        inputMode="numeric"
        min={1}
        defaultValue={params.user_id ?? ''}
        placeholder="User id"
        aria-label="User id"
        className="h-9 w-[110px]"
      />
      <Input
        name="space_id"
        type="number"
        inputMode="numeric"
        min={1}
        defaultValue={params.space_id ?? ''}
        placeholder="Space id"
        aria-label="Space id"
        className="h-9 w-[110px]"
      />
      <Input
        name="from"
        type="date"
        defaultValue={params.from ?? ''}
        aria-label="From date"
        className="h-9 w-[150px]"
      />
      <Input
        name="to"
        type="date"
        defaultValue={params.to ?? ''}
        aria-label="To date"
        className="h-9 w-[150px]"
      />
      <Button type="submit" variant="outline" size="sm" className="h-9">
        Apply
      </Button>
      {hasChatErrorFilters(params) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1 text-muted-foreground"
          onClick={() => onParamsChange({ ...CLEARED, page: 1 })}
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}
    </form>
  );
}
