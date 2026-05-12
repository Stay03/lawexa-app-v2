'use client';

import { useState } from 'react';
import { Loader2, Search, UserRound, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useAdminUsersSearch } from '@/lib/hooks/useAdmin';
import type { IAdminUserListItem } from '@/types/admin';

const MIN_QUERY_LENGTH = 2;

export interface AdminUserSinglePickerValue {
  id: number;
  name: string;
  email: string | null;
  uuid?: string;
}

export interface AdminUserSinglePickerProps {
  value: AdminUserSinglePickerValue | null;
  onChange: (next: AdminUserSinglePickerValue | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function AdminUserSinglePicker({
  value,
  onChange,
  placeholder = 'Filter by user…',
  disabled,
  className,
}: AdminUserSinglePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 250);

  const { data, isFetching } = useAdminUsersSearch(debouncedQuery, {
    perPage: 10,
    minLength: MIN_QUERY_LENGTH,
  });

  const results = data?.data ?? [];

  const pick = (user: IAdminUserListItem) => {
    onChange({
      id: user.id,
      name: user.name,
      email: user.email,
      uuid: user.uuid,
    });
    setQuery('');
    setOpen(false);
  };

  return (
    <div className={cn('inline-flex items-center', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'gap-1.5 justify-start font-normal min-w-[180px]',
              !value && 'text-muted-foreground'
            )}
            disabled={disabled}
          >
            <UserRound className="h-3.5 w-3.5 shrink-0" />
            {value ? (
              <span className="truncate max-w-[180px]">
                {value.name || value.email || `User #${value.id}`}
              </span>
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) p-0 gap-0 min-w-[280px]"
        >
          <div className="relative border-b">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="h-10 border-0 pl-9 focus-visible:ring-0"
            />
          </div>

          <div className="max-h-72 overflow-y-auto">
            {debouncedQuery.trim().length < MIN_QUERY_LENGTH ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Type at least {MIN_QUERY_LENGTH} characters to search.
              </p>
            ) : isFetching && results.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching…
              </div>
            ) : results.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No users match &quot;{debouncedQuery}&quot;.
              </p>
            ) : (
              <ul className="py-1">
                {results.map((user) => {
                  const isCurrent = value?.id === user.id;
                  return (
                    <li key={user.id}>
                      <button
                        type="button"
                        onClick={() => pick(user)}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/60 transition-colors',
                          isCurrent && 'bg-muted/50'
                        )}
                      >
                        <Avatar user={user} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {user.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {user.email ?? '—'}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-1 h-7 w-7 p-0 shrink-0"
          onClick={() => onChange(null)}
          aria-label="Clear user filter"
          disabled={disabled}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function Avatar({ user }: { user: IAdminUserListItem }) {
  if (user.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatar_url}
        alt=""
        className="h-7 w-7 rounded-full object-cover shrink-0"
      />
    );
  }
  const initial = (user.name || user.email || '?').charAt(0).toUpperCase();
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground shrink-0">
      {initial}
    </div>
  );
}
