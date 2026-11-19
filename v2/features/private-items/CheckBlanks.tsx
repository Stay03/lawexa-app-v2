'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { BlankEdit, TemplateBlank } from '@/types/private-items';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { applyBlankEdits, blankName, blanksOf } from './pages-model';
import { privateItemsQueries, useTemplateMutations } from './queries';
import { TemplateDocument } from './TemplateDocument';

/**
 * "Check the blanks" (Arthur's pages, 19 November 2026; Clio and Juro make
 * this part of upload, because lawyers need to trust the blanks). The
 * document with its blanks marked, and the list of blanks beside it: rename
 * one, merge two or more, take one out, or select text Lawexa missed and make
 * it a blank. Every change shows at once; Save sends them in order (PUT
 * .../blanks), and saving with no changes says the blanks are right.
 */
export function CheckBlanks({ uuid, open, onClose }: { uuid: string; open: boolean; onClose: () => void }) {
  const query = useQuery({ ...privateItemsQueries.template(uuid), enabled: open });
  const mutations = useTemplateMutations();
  const [edits, setEdits] = useState<BlankEdit[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [picked, setPicked] = useState('');

  const segments = useMemo(() => applyBlankEdits(query.data?.segments ?? [], edits), [query.data, edits]);
  const blanks = useMemo(() => blanksOf(segments), [segments]);
  const add = (edit: BlankEdit) => setEdits((current) => [...current, edit]);

  const save = () =>
    mutations.saveBlanks.mutate(
      { uuid, edits },
      {
        onSuccess: () => {
          toast.success(edits.length ? 'Blanks saved.' : 'Blanks checked.');
          onClose();
        },
        onError: (error) => toast.error(extractApiError(error).message),
      },
    );

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      guardUnsaved={edits.length > 0}
      className="md:max-w-5xl"
      title="Check the blanks"
      description={
        query.data
          ? `${query.data.name}. Lawexa fills these in each time it drafts from this template.`
          : 'Lawexa fills these in each time it drafts from this template.'
      }
      footer={
        <>
          {edits.length > 0 ? (
            <Button variant="ghost" onClick={() => setEdits((current) => current.slice(0, -1))} className="md:mr-auto">
              <Undo2 aria-hidden className="size-4" />
              Undo
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!query.data || mutations.saveBlanks.isPending}>
            {mutations.saveBlanks.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {edits.length ? `Save ${edits.length} ${edits.length === 1 ? 'change' : 'changes'}` : 'The blanks are right'}
          </Button>
        </>
      }
    >
      {query.isPending ? (
        <div aria-hidden className="grid gap-4 md:grid-cols-[1fr_20rem]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {extractApiError(query.error).message || 'The template did not load.'}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_20rem] md:items-start">
          <div className="order-2 flex flex-col gap-2 md:order-1">
            <p className="text-xs text-muted-foreground">Select words in the document to make them a blank.</p>
            {picked ? (
              <MakeBlank
                key={picked}
                passage={picked}
                onCancel={() => setPicked('')}
                onAdd={(name) => {
                  add({ op: 'add', passage: picked, blank: name });
                  setPicked('');
                }}
              />
            ) : null}
            <TemplateDocument
              segments={segments}
              selected={selected}
              onBlank={(name) => setSelected((current) => (current === name ? null : name))}
              onSelectText={(text) => setPicked(text.slice(0, 200))}
              className="max-h-[60dvh] overflow-y-auto md:max-h-[64vh]"
            />
          </div>
          <BlankList
            blanks={blanks}
            selected={selected}
            checked={checked}
            onSelect={(name) => setSelected((current) => (current === name ? null : name))}
            onCheck={(name, on) => setChecked((current) => (on ? [...current, name] : current.filter((n) => n !== name)))}
            onEdit={(edit) => {
              add(edit);
              setSelected(null);
              setChecked([]);
            }}
            className="order-1 md:order-2 md:sticky md:top-0"
          />
        </div>
      )}
    </ResponsiveOverlay>
  );
}

function MakeBlank({ passage, onAdd, onCancel }: { passage: string; onAdd: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const clean = blankName(name);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-accent/60 p-3">
      <p className="text-[13px] text-foreground">
        Make <span className="font-medium">&ldquo;{passage.length > 60 ? `${passage.slice(0, 60)}…` : passage}&rdquo;</span> a blank, everywhere it appears.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Blank name, e.g. RENT AMOUNT" className="h-9 max-w-64" autoFocus />
        <Button size="sm" disabled={!clean} onClick={() => onAdd(clean)}>
          <Plus aria-hidden className="size-4" />
          Make it a blank
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function BlankList({
  blanks,
  selected,
  checked,
  onSelect,
  onCheck,
  onEdit,
  className,
}: {
  blanks: TemplateBlank[];
  selected: string | null;
  checked: string[];
  onSelect: (name: string) => void;
  onCheck: (name: string, on: boolean) => void;
  onEdit: (edit: BlankEdit) => void;
  className?: string;
}) {
  const [mergeName, setMergeName] = useState('');
  return (
    <section aria-label="Blanks" className={cn('flex flex-col overflow-hidden rounded-xl border border-border bg-card', className)}>
      <header className="flex items-baseline justify-between gap-2 border-b border-border/70 px-3.5 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">{blanks.length} blanks</h3>
        <span className="text-xs text-muted-foreground">Tick two or more to merge</span>
      </header>
      {checked.length >= 2 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-accent/50 px-3.5 py-2.5">
          <Input
            value={mergeName}
            onChange={(event) => setMergeName(event.target.value)}
            placeholder={checked[0]}
            aria-label="Name for the merged blank"
            className="h-8 min-w-0 flex-1"
          />
          <Button
            size="sm"
            onClick={() => {
              onEdit({ op: 'merge', blanks: checked, to: blankName(mergeName) || checked[0] });
              setMergeName('');
            }}
          >
            Merge {checked.length}
          </Button>
        </div>
      ) : null}
      {/* A phone lets the list grow (the sheet scrolls), so an opened blank is never under a fold. */}
      <ul className="divide-y divide-border/60 md:max-h-[58vh] md:overflow-y-auto">
        {blanks.map((blank) => (
          <BlankRow
            key={blank.name}
            blank={blank}
            open={selected === blank.name}
            checked={checked.includes(blank.name)}
            onSelect={() => onSelect(blank.name)}
            onCheck={(on) => onCheck(blank.name, on)}
            onEdit={onEdit}
          />
        ))}
      </ul>
    </section>
  );
}

function BlankRow({
  blank,
  open,
  checked,
  onSelect,
  onCheck,
  onEdit,
}: {
  blank: TemplateBlank;
  open: boolean;
  checked: boolean;
  onSelect: () => void;
  onCheck: (on: boolean) => void;
  onEdit: (edit: BlankEdit) => void;
}) {
  const [rename, setRename] = useState(blank.name);
  const [replacement, setReplacement] = useState('');
  return (
    <li className={cn('px-3.5 py-2.5', open && 'bg-accent/40')}>
      <div className="flex items-center gap-2.5">
        <Checkbox checked={checked} onCheckedChange={(value) => onCheck(value === true)} aria-label={`Tick ${blank.name} to merge`} />
        <button type="button" onClick={onSelect} aria-expanded={open} className="v2-interactive flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="truncate rounded-md bg-amber-100 px-1.5 py-0.5 text-[12px] font-semibold tracking-wide text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">
            {blank.name}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{blank.count === 1 ? 'once' : `${blank.count} times`}</span>
        </button>
      </div>
      {open ? (
        <div className="mt-2.5 flex flex-col gap-2.5 pl-7">
          <ul className="space-y-1">
            {blank.examples.map((example) => (
              <li key={example} className="text-xs leading-snug text-muted-foreground">
                {example}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <Input value={rename} onChange={(event) => setRename(event.target.value)} aria-label={`New name for ${blank.name}`} className="h-8" />
            <Button
              size="sm"
              variant="outline"
              disabled={!blankName(rename) || blankName(rename) === blank.name}
              onClick={() => onEdit({ op: 'rename', from: blank.name, to: blankName(rename) })}
            >
              Rename
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
              placeholder="Fixed text (optional)"
              aria-label={`Text to put instead of ${blank.name}`}
              className="h-8"
            />
            <Button size="sm" variant="outline" onClick={() => onEdit({ op: 'remove', blank: blank.name, text: replacement })}>
              Not a blank
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
