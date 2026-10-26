'use client';

import { useId, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import type { RadarEmailAudience } from '@/types/radar';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useV2Session } from '@/v2/runtime/session-context';
import { MemberAvatar } from '@/v2/features/collab/membership/MemberAvatar';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { chosenMembersLine } from './email-audience';

const CHOICES: readonly { value: RadarEmailAudience; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'chosen', label: 'Chosen members' },
];

/**
 * "Email reports to" on a space Radar (plan 6.2, Backend's B4): every member
 * of the space, or the members chosen here. Either way the email skips a
 * member who turned Radar notices off for the space, and the report still
 * shows in the space for all. The picker lists the space's active members by
 * name and picture, never an address (members do not see each other's).
 *
 * The two choices are a radio group: one tab stop, the arrow keys move.
 */
export function EmailAudienceField({
  spaceUuid,
  audience,
  members,
  error,
  onAudienceChange,
  onMembersChange,
}: {
  spaceUuid: string;
  audience: RadarEmailAudience;
  /** The chosen members' user uuids. */
  members: string[];
  error?: string;
  onAudienceChange: (next: RadarEmailAudience) => void;
  onMembersChange: (next: string[]) => void;
}) {
  const uid = useId();
  const { userId: viewerId } = useV2Session();
  const roster = useQuery({
    ...spacesQueries.members(spaceUuid, { viewerId }),
    enabled: audience === 'chosen',
  });
  const active = (roster.data?.data ?? []).filter((member) => member.is_active && !member.is_pending);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const next = audience === 'everyone' ? 'chosen' : 'everyone';
    onAudienceChange(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next}"]`)?.focus();
  };

  const toggle = (uuid: string, checked: boolean) => {
    onMembersChange(checked ? [...members, uuid] : members.filter((chosen) => chosen !== uuid));
  };

  return (
    <div className="space-y-3 px-4 py-3">
      <div>
        <p id={`${uid}-label`} className="text-sm font-medium text-foreground">
          Email reports to
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Reports always show in the Space. A member who turned Radar notices off gets no email.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-labelledby={`${uid}-label`}
        onKeyDown={onKeyDown}
        className="inline-flex rounded-full bg-secondary p-1"
      >
        {CHOICES.map((choice) => {
          const selected = audience === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={selected}
              data-value={choice.value}
              tabIndex={selected ? 0 : -1}
              onClick={() => onAudienceChange(choice.value)}
              className={cn(
                'v2-interactive min-h-8 rounded-full px-3.5 text-sm font-medium transition-colors',
                selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                FOCUS_RING,
              )}
            >
              {choice.label}
            </button>
          );
        })}
      </div>

      {audience === 'chosen' ? (
        <div className="space-y-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {chosenMembersLine(members.length)}
          </p>
          {roster.isPending ? (
            <div aria-hidden className="space-y-2">
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ) : roster.isError ? (
            <p role="alert" className="text-xs text-destructive">
              Couldn&apos;t load the members. Close the form and try again.
            </p>
          ) : (
            <ul aria-label="Members" className="max-h-60 divide-y overflow-y-auto rounded-lg border">
              {active.map((member) => {
                const id = `${uid}-${member.user.uuid}`;
                return (
                  <li key={member.user.uuid}>
                    <label
                      htmlFor={id}
                      className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-secondary/50"
                    >
                      <Checkbox
                        id={id}
                        checked={members.includes(member.user.uuid)}
                        onCheckedChange={(checked) => toggle(member.user.uuid, checked === true)}
                      />
                      <MemberAvatar user={member.user} className="size-7" />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{member.user.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
