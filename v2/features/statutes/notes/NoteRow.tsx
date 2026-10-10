'use client';

import { useState, type ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { PrintNoteKind, StatuteAnnotation, StatuteAnnotationType } from '@/types/statute';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { partLabel } from './labels';
import { useDecideNote, useDeleteNote, useUpdateNote } from './mutations';
import { NoteImages } from './NoteImages';
import { NoteImagesForm } from './NoteImagesForm';

/**
 * One note in the panel: what it says, where it sits, and what a researcher
 * can do with it. The note itself is the jump target (when it has a place);
 * Edit, Decide and Delete sit under it, so a tap meant for the text never
 * lands on an action. Edit and Decide open in the row itself, where the note
 * they change is still in view; Delete asks first.
 *
 * The pictures of the print sit between the note and its actions: page
 * thumbnails that open full size. "Add images" (or "Edit images") opens their
 * form in the row, in place of the thumbnails (10 October 2026).
 */

export const NOTE_TYPES: readonly { value: StatuteAnnotationType; label: string }[] = [
  { value: 'print_error', label: 'Printing error' },
  { value: 'typo', label: 'Typo' },
  { value: 'doubt', label: 'Doubt' },
  { value: 'note', label: 'Note' },
];

export const PRINT_NOTE_KIND_LABEL: Record<PrintNoteKind, string> = {
  typo: 'Typo',
  missing: 'Missing',
  grammar: 'Grammar',
  punctuation: 'Punctuation',
  reference: 'Reference',
  unclear: 'Unclear',
  layout: 'Layout',
};

/**
 * The printed words beside ours, so the difference reads at a glance (Stay,
 * 29 September 2026: "it should show printed text and our text"). An empty
 * side says what its emptiness means: words we added are "not in the print",
 * words we left out are "left out".
 */
function PrintedAgainstOurs({ printed, ours }: { printed: string | null; ours: string | null }) {
  return (
    <span className="grid grid-cols-2 gap-2">
      <ComparedSide label="Printed" text={printed} empty="not in the print" />
      <ComparedSide label="Our text" text={ours} empty="left out" />
    </span>
  );
}

function ComparedSide({ label, text, empty }: { label: string; text: string | null; empty: string }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5 rounded-md bg-secondary/60 px-2.5 py-2">
      <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {text ? (
        <span className="break-words font-serif text-[0.9375rem] leading-snug text-foreground">{text}</span>
      ) : (
        <span className="text-sm italic text-muted-foreground">{empty}</span>
      )}
    </span>
  );
}

/** The API's limits (StoreStatuteAnnotationRequest, DecideStatuteAnnotationRequest). */
const BODY_MAX = 5000;
const DECISION_MAX = 2000;

type Mode = 'view' | 'edit' | 'decide' | 'images';

export function NoteRow({
  note,
  slug,
  onSelect,
}: {
  note: StatuteAnnotation;
  slug: string;
  onSelect?: (note: StatuteAnnotation) => void;
}) {
  const [mode, setMode] = useState<Mode>('view');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useDeleteNote(slug);

  const compared = Boolean(note.printed_text || note.our_text);
  const content = (
    <>
      <span className="flex flex-wrap items-center gap-2">
        {note.node ? <span className="text-sm font-medium text-foreground">{partLabel(note.node.eid)}</span> : null}
        <Badge variant="secondary">{note.kind ? (note.kind_label ?? PRINT_NOTE_KIND_LABEL[note.kind]) : note.type_label}</Badge>
        {note.status === 'decided' ? <Badge variant="outline">Decided</Badge> : null}
      </span>
      {compared ? (
        <PrintedAgainstOurs printed={note.printed_text ?? null} ours={note.our_text ?? null} />
      ) : note.quote ? (
        <span className="font-serif text-[0.9375rem] italic leading-snug text-foreground/90">“{note.quote}”</span>
      ) : null}
      <span className="whitespace-pre-line text-sm text-muted-foreground">{note.reason || note.body}</span>
      {note.decision ? (
        <span className="text-sm text-foreground">
          <span className="font-medium">Decision:</span> {note.decision}
        </span>
      ) : null}
      {note.text_changed ? (
        <span className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle aria-hidden className="size-3.5" />
          Text changed: these words are no longer in this part.
        </span>
      ) : null}
    </>
  );

  return (
    <div className="flex flex-col gap-1 py-3">
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(note)}
          className={cn('-mx-2 flex flex-col gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary', FOCUS_RING)}
        >
          {content}
        </button>
      ) : (
        <div className="flex flex-col gap-1.5 py-1.5">{content}</div>
      )}

      {mode !== 'images' ? <NoteImages note={note} slug={slug} /> : null}

      {mode === 'edit' ? (
        <EditForm note={note} slug={slug} onDone={() => setMode('view')} />
      ) : mode === 'decide' ? (
        <DecideForm note={note} slug={slug} onDone={() => setMode('view')} />
      ) : mode === 'images' ? (
        <NoteImagesForm note={note} slug={slug} onDone={() => setMode('view')} />
      ) : (
        <div className="flex flex-wrap gap-1 text-xs">
          <RowAction onClick={() => setMode('edit')}>Edit</RowAction>
          <RowAction onClick={() => setMode('decide')}>
            {note.status === 'decided' ? 'Change decision' : 'Decide'}
          </RowAction>
          <RowAction onClick={() => setMode('images')}>
            {note.images && note.images.length > 0 ? 'Edit images' : 'Add images'}
          </RowAction>
          <RowAction onClick={() => setConfirmDelete(true)} tone="destructive">
            Delete
          </RowAction>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this print note?</AlertDialogTitle>
            <AlertDialogDescription>
              {note.node ? `The ${note.type_label.toLowerCase()} print note on ${partLabel(note.node.eid)}` : 'This print note'} is
              deleted for every researcher.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={(event) => {
                // Keep the dialog open until the server has answered.
                event.preventDefault();
                remove.mutate({ uuid: note.uuid }, { onSuccess: () => setConfirmDelete(false) });
              }}
            >
              {remove.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowAction({
  children,
  onClick,
  tone = 'default',
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'default' | 'destructive';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-2 py-1 font-medium transition-colors',
        tone === 'destructive'
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        FOCUS_RING,
      )}
    >
      {children}
    </button>
  );
}

function EditForm({ note, slug, onDone }: { note: StatuteAnnotation; slug: string; onDone: () => void }) {
  const [type, setType] = useState<StatuteAnnotationType>(note.type);
  const [body, setBody] = useState(note.body);
  const update = useUpdateNote(slug);
  const trimmed = body.trim();
  const unchanged = type === note.type && trimmed === note.body.trim();
  const id = `note-${note.uuid}`;

  return (
    <form
      className="flex flex-col gap-2.5 rounded-lg border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!trimmed || unchanged) return;
        update.mutate({ uuid: note.uuid, type, body: trimmed }, { onSuccess: onDone });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-type`}>Type</Label>
        <Select value={type} onValueChange={(value) => setType(value as StatuteAnnotationType)}>
          <SelectTrigger id={`${id}-type`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NOTE_TYPES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-body`}>Note</Label>
        <Textarea
          id={`${id}-body`}
          value={body}
          maxLength={BODY_MAX}
          rows={4}
          onChange={(event) => setBody(event.target.value)}
        />
      </div>
      <FormButtons pending={update.isPending} disabled={!trimmed || unchanged} onCancel={onDone} />
    </form>
  );
}

function DecideForm({ note, slug, onDone }: { note: StatuteAnnotation; slug: string; onDone: () => void }) {
  const [decision, setDecision] = useState(note.decision ?? '');
  const decide = useDecideNote(slug);
  const trimmed = decision.trim();
  const id = `decide-${note.uuid}`;

  return (
    <form
      className="flex flex-col gap-2.5 rounded-lg border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!trimmed) return;
        decide.mutate({ uuid: note.uuid, decision: trimmed }, { onSuccess: onDone });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>What was decided</Label>
        <Textarea
          id={id}
          value={decision}
          maxLength={DECISION_MAX}
          rows={3}
          placeholder='For example "keep as printed" or "corrected in our copy".'
          onChange={(event) => setDecision(event.target.value)}
        />
      </div>
      <FormButtons pending={decide.isPending} disabled={!trimmed} onCancel={onDone} saveLabel="Save decision" />
    </form>
  );
}

function FormButtons({
  pending,
  disabled,
  onCancel,
  saveLabel = 'Save',
}: {
  pending: boolean;
  disabled: boolean;
  onCancel: () => void;
  saveLabel?: string;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
        Cancel
      </Button>
      <Button type="submit" size="sm" disabled={pending || disabled}>
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        {saveLabel}
      </Button>
    </div>
  );
}
