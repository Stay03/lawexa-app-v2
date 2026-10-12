'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { InviteRoleOption } from './invite-roles';

/**
 * RoleSelect — the role picker the invite dialog and the invite links panel
 * share (design round 1, 12 October 2026).
 *
 * The open list shows each role on two lines, its name and then what it may
 * do; the closed trigger shows the NAME ONLY, through `SelectValue`'s own
 * children, so "Contributor" never has to fit beside a sentence on a 360px
 * phone. Only values the list offers can be chosen: the change is read back
 * off the list rather than cast from the string.
 */
export function RoleSelect<Role extends string>({
  id,
  value,
  roles,
  onChange,
}: {
  id: string;
  value: Role;
  roles: readonly InviteRoleOption<Role>[];
  onChange: (role: Role) => void;
}) {
  const current = roles.find((option) => option.value === value);
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const chosen = roles.find((option) => option.value === next);
        if (chosen) onChange(chosen.value);
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue>{current?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {roles.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="text-sm font-medium">{option.label}</span>
              {option.description ? (
                <span className="text-xs text-muted-foreground">{option.description}</span>
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
