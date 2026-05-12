'use client';

import { useState } from 'react';
import { Loader2, Search, UserPlus, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
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

export interface AdminUserSearchPickerProps {
  selected: IAdminUserListItem[];
  onChange: (next: IAdminUserListItem[]) => void;
  disabled?: boolean;
  max?: number;
}

const MIN_QUERY_LENGTH = 2;

export function AdminUserSearchPicker({
  selected,
  onChange,
  disabled,
  max,
}: AdminUserSearchPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 250);

  const { data, isFetching } = useAdminUsersSearch(debouncedQuery, {
    perPage: 10,
    minLength: MIN_QUERY_LENGTH,
  });

  const selectedIds = new Set(selected.map((u) => u.id));
  const results = (data?.data ?? []).filter((u) => !selectedIds.has(u.id));
  const atCap = typeof max === 'number' && selected.length >= max;

  const addUser = (user: IAdminUserListItem) => {
    if (atCap) return;
    onChange([...selected, user]);
    setQuery('');
  };

  const removeUser = (id: number) => {
    onChange(selected.filter((u) => u.id !== id));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start font-normal text-muted-foreground"
            disabled={disabled || atCap}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {atCap
              ? `Max ${max} users selected`
              : 'Search users by name or email…'}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0 gap-0">
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
                {results.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => addUser(user)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/60 transition-colors',
                        atCap && 'opacity-50 cursor-not-allowed'
                      )}
                      disabled={atCap}
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
                      {user.subscription_plan && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {user.subscription_plan}
                        </Badge>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((user) => (
            <span
              key={user.id}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 py-1 pl-2 pr-1 text-xs"
            >
              <span className="truncate max-w-[200px] font-medium">
                {user.name}
              </span>
              <span className="truncate max-w-[180px] text-muted-foreground">
                {user.email ?? '—'}
              </span>
              <button
                type="button"
                onClick={() => removeUser(user.id)}
                className="rounded-full p-0.5 hover:bg-background"
                aria-label={`Remove ${user.name}`}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
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
