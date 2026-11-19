'use client';

import { useDeferredValue, useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  Copy,
  FlaskConical,
  History,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  PencilLine,
  Plus,
  RotateCw,
  ScrollText,
  Search,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { MySkill } from '@/types/private-items';
import { useMinuteNow } from '@/v2/features/channels/use-minute-now';
import { askHref, queueAsk } from '@/v2/shell/designs/composer/ask-param';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { SettingsState } from '../settings/SettingsState';
import { AllowedInChips } from './AllowedInChips';
import { DeleteItemDialog } from './ItemDialogs';
import { ITEMS_COLUMN } from './MyTemplatesScreen';
import { usedLine } from './pages-model';
import { privateItemsQueries, useSkillMutations } from './queries';
import { SkillDialog } from './SkillDialog';
import { ItemsFallback } from './states';
import { VersionHistory } from './VersionHistory';

/** What "Create in chat" puts in the box: Lawexa asks a few questions and drafts the skill. */
export const SKILL_ASK_PROMPT = 'Help me create a skill for ';
const HOME = { kind: 'home' } as const;

/**
 * Settings > My skills (Arthur agreed the page, 19 November 2026, thread
 * 9ae498ae): only the person's own skills. Each says when Lawexa uses it (the
 * line Lawexa picks skills from) and has an on/off switch: off, Lawexa never
 * picks it. Create in chat (Lawexa asks a few questions and drafts it, as
 * Claude does) or Write it myself, with a Test beside the fields.
 */
export function MySkillsScreen() {
  const [search, setSearch] = useState('');
  const query = useInfiniteQuery(privateItemsQueries.mySkills(useDeferredValue(search.trim())));
  const mutations = useSkillMutations();
  const now = useMinuteNow();
  // `null` writes a new skill; a skill edits it; undefined is closed.
  const [editing, setEditing] = useState<MySkill | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<MySkill | null>(null);
  const [history, setHistory] = useState<MySkill | null>(null);

  const rows = query.data?.pages.flatMap((page) => page.data) ?? [];
  const hasAny = rows.length > 0 || search.trim() !== '';

  const toggle = (skill: MySkill, on: boolean) =>
    mutations.update.mutate(
      { uuid: skill.uuid, input: { is_active: on } },
      {
        onSuccess: () => toast.success(on ? `${skill.display_name} is on.` : `${skill.display_name} is off. Lawexa won't use it.`),
        onError: (error) => toast.error(extractApiError(error).message),
      },
    );

  const createChoices = (
    <>
      <DropdownMenuItem asChild>
        <Link href={askHref(HOME, SKILL_ASK_PROMPT)} onClick={() => queueAsk(HOME, SKILL_ASK_PROMPT)}>
          <MessageSquarePlus />
          <span className="flex flex-col">
            <span>Create in chat</span>
            <span className="text-xs text-muted-foreground">Lawexa asks a few questions and drafts it</span>
          </span>
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => setEditing(null)}>
        <PencilLine />
        <span className="flex flex-col">
          <span>Write it myself</span>
          <span className="text-xs text-muted-foreground">Name, when to use it, steps, an example</span>
        </span>
      </DropdownMenuItem>
    </>
  );

  return (
    <div className={ITEMS_COLUMN}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">My skills</h1>
        {hasAny ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="rounded-full">
                <Plus aria-hidden className="size-4" />
                New skill
                <ChevronDown aria-hidden className="size-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              {createChoices}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {hasAny ? (
        <div className="relative mb-5">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your skills"
            aria-label="Search your skills"
            className="h-10 rounded-full pl-9"
          />
        </div>
      ) : null}

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
      ) : rows.length === 0 && hasAny ? (
        <SettingsState icon={Search} title="No skills match" description="Try other words." />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <ScrollText aria-hidden className="size-8 text-primary" />
          <h2 className="mt-3 text-base font-semibold text-foreground">No skills yet</h2>
          <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
            A skill is the steps you want Lawexa to follow for one kind of task, such as reviewing a quit notice the way your chambers does.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button asChild className="rounded-full">
              <Link href={askHref(HOME, SKILL_ASK_PROMPT)} onClick={() => queueAsk(HOME, SKILL_ASK_PROMPT)}>
                <MessageSquarePlus aria-hidden className="size-4" />
                Create in chat
              </Link>
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => setEditing(null)}>
              <PencilLine aria-hidden className="size-4" />
              Write it myself
            </Button>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-card">
          {rows.map((skill) => {
            const on = skill.is_active !== false;
            return (
              <li key={skill.uuid} className="flex items-start gap-3.5 px-4 py-3.5">
                <ScrollText aria-hidden className={cn('mt-0.5 size-5 shrink-0', on ? 'text-primary' : 'text-muted-foreground')} />
                <div className={cn('flex min-w-0 flex-1 flex-col gap-1', !on && 'opacity-60')}>
                  <button
                    type="button"
                    onClick={() => setEditing(skill)}
                    className="v2-interactive line-clamp-2 text-left text-[15px] leading-snug font-medium text-foreground hover:underline"
                  >
                    {skill.display_name}
                  </button>
                  <p className="line-clamp-2 text-[13px] leading-snug text-foreground/80">
                    <span className="text-muted-foreground">When Lawexa uses it: </span>
                    {skill.description}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {on ? usedLine(skill.last_used_at, now) : 'Off: Lawexa won’t use it'} · version {skill.version}
                  </span>
                  <AllowedInChips allowedIn={skill.allowed_in} itemName={skill.display_name} />
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Switch checked={on} onCheckedChange={(next) => toggle(skill, next)} aria-label={`${skill.display_name}: ${on ? 'on' : 'off'}`} />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Actions for ${skill.display_name}`}
                      className={cn(
                        'v2-interactive flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
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
                      <DropdownMenuItem onSelect={() => setEditing(skill)}>
                        <FlaskConical />
                        Test
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          mutations.duplicate.mutate(skill.uuid, {
                            onSuccess: (copy) => toast.success(`${copy.display_name} added.`),
                            onError: (error) => toast.error(extractApiError(error).message),
                          })
                        }
                      >
                        <Copy />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setHistory(skill)}>
                        <History />
                        Version history
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(skill)}>
                        <Trash2 />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
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
      {history ? (
        <VersionHistory kind="skill" uuid={history.uuid} name={history.display_name} open onClose={() => setHistory(null)} />
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
