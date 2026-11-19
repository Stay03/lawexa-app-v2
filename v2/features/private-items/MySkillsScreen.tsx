'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Loader2, MoreHorizontal, Pencil, Plus, RotateCw, Sparkles, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { MySkill } from '@/types/private-items';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { SETTINGS_COLUMN } from '../settings/SettingsList';
import { SettingsFormGroup } from '../settings/SettingsForm';
import { SettingsState } from '../settings/SettingsState';
import { AllowedInChips } from './AllowedInChips';
import { DeleteItemDialog } from './ItemDialogs';
import { privateItemsQueries, useSkillMutations } from './queries';
import { SkillDialog } from './SkillDialog';
import { ItemsFallback } from './states';

/**
 * Settings > My skills (Stay, thread 9ae498ae): a person's own drafting steps.
 * Each works at once in their own chats, with no admin review. In a Space,
 * Lawexa asks first; the Spaces where they said "always" show under the skill
 * with × to take it back.
 */
export function MySkillsScreen() {
  const query = useInfiniteQuery(privateItemsQueries.mySkills());
  const mutations = useSkillMutations();
  // `null` writes a new skill; a skill edits it; undefined is closed.
  const [editing, setEditing] = useState<MySkill | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<MySkill | null>(null);

  const rows = query.data?.pages.flatMap((page) => page.data) ?? [];

  const newButton = (
    <Button onClick={() => setEditing(null)} className="rounded-full">
      <Plus aria-hidden className="size-4" />
      New skill
    </Button>
  );

  return (
    <div className={SETTINGS_COLUMN}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">My skills</h1>
        {rows.length > 0 ? newButton : null}
      </div>

      {query.isPending ? (
        <ItemsFallback label="Loading your skills" />
      ) : query.isError ? (
        <SettingsState
          icon={TriangleAlert}
          tone="alarm"
          title="Your skills did not load"
          description="Check your connection and try again."
          action={
            <Button size="sm" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RotateCw aria-hidden className={cn('size-4', query.isFetching && 'animate-spin')} />
              Try again
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <SettingsState
          icon={Sparkles}
          title="No skills yet"
          description="Write the steps you want Lawexa to follow for a kind of task, or save one Lawexa drafts for you in a chat."
          action={newButton}
        />
      ) : (
        <SettingsFormGroup
          id="my-skills"
          label="Your skills"
          description="Only your chats use these. In a Space, Lawexa asks you first."
        >
          {rows.map((skill) => (
            <li key={skill.uuid} className="flex min-h-16 items-start gap-3.5 px-4 py-3">
              <Sparkles aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] leading-snug font-medium text-foreground">{skill.display_name}</span>
                <span className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{skill.description}</span>
                <AllowedInChips allowedIn={skill.allowed_in} itemName={skill.display_name} />
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Actions for ${skill.display_name}`}
                  className={cn(
                    'v2-interactive -mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                    FOCUS_RING,
                  )}
                >
                  <MoreHorizontal aria-hidden className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(skill)}>
                    <Pencil />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(skill)}>
                    <Trash2 />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </SettingsFormGroup>
      )}

      {query.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Show more
          </Button>
        </div>
      ) : null}

      {editing !== undefined ? (
        <SkillDialog
          key={editing?.uuid ?? 'new'}
          skill={editing}
          onClose={() => setEditing(undefined)}
          onSave={async (input) => {
            if (editing) await mutations.update.mutateAsync({ uuid: editing.uuid, input });
            else await mutations.create.mutateAsync(input);
            toast.success(editing ? 'Skill saved.' : 'Skill saved. Lawexa can use it in your chats now.');
            setEditing(undefined);
          }}
        />
      ) : null}
      {deleting ? (
        <DeleteItemDialog
          open
          kind="skill"
          name={deleting.display_name}
          spaces={deleting.allowed_in.length}
          pending={mutations.remove.isPending}
          onClose={() => setDeleting(null)}
          onDelete={() =>
            mutations.remove.mutate(deleting.uuid, {
              onSuccess: () => {
                toast.success(`${deleting.display_name} deleted.`);
                setDeleting(null);
              },
              onError: (error) => toast.error(extractApiError(error).message),
            })
          }
        />
      ) : null}
    </div>
  );
}
