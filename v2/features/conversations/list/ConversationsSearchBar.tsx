'use client';

import { SearchField } from '@/v2/shell/SearchField';

/**
 * The `/conversations` search box.
 *
 * The control itself moved to `v2/shell/SearchField.tsx` when the cases list
 * needed the same one — together with `SearchFieldShape`, the still reservation
 * every route fallback draws in its place, so the live field and its reservation
 * can no longer drift apart. This stays as the named call site.
 */
export function ConversationsSearchBar({
  value,
  onChange,
  onClear,
  busy = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <SearchField
      value={value}
      onChange={onChange}
      onClear={onClear}
      busy={busy}
      placeholder="Search conversations by title..."
      label="Search conversations by title"
      className={className}
    />
  );
}
