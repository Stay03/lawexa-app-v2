'use client';

import { useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { StatuteAnnotationCreate, StatuteAnnotationType } from '@/types/statute';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useStatuteNotes, type NoteDraft } from './context';
import { partLabel } from './labels';
import { useCreateNote } from './mutations';
import { NOTE_TYPES } from './NoteRow';

/**
 * Writing a new note, at the top of the notes panel.
 *
 * From a selection it knows its place and words: the part the words sit in
 * and the quote, shown as the note will mark them. From the panel's
 * New note it offers two places: the whole statute, or the part the reader
 * has in view. Saving refetches the list (the server orders it) and shows
 * the new note on its own, so the researcher sees what was stored.
 */

const BODY_MAX = 5000;

type Place = 'statute' | 'part';

export function NewNoteForm({ draft, inViewEid }: { draft: NoteDraft; inViewEid: string | null }) {
  const { slug, statuteId, clearDraft, openPanel } = useStatuteNotes();
  const create = useCreateNote(slug, statuteId);

  const fixedPart = draft.kind === 'part' ? draft : null;
  // Only a draft with no place of its own offers a choice, and only when a
  // part is in view to choose.
  const [place, setPlace] = useState<Place>(fixedPart ? 'part' : 'statute');
  const [type, setType] = useState<StatuteAnnotationType>('print_error');
  const [body, setBody] = useState('');
  const trimmed = body.trim();

  const eid = fixedPart ? fixedPart.eid : place === 'part' ? inViewEid : null;
  const quote = fixedPart?.quote ?? null;

  const apiError = create.error ? extractApiError(create.error) : null;
  const errorMessage = apiError
    ? apiError.status >= 400 && apiError.status < 500
      ? apiError.message
      : "Couldn't save the note. Try again."
    : null;

  const save = () => {
    if (!trimmed || create.isPending) return;
    const note: StatuteAnnotationCreate = {
      type,
      body: trimmed,
      ...(eid ? { eid } : {}),
      ...(eid && quote
        ? {
            quote: quote.quote,
            prefix: quote.prefix,
            suffix: quote.suffix,
            start_offset: quote.startOffset,
            end_offset: quote.endOffset,
          }
        : {}),
    };
    create.mutate(note, {
      onSuccess: (response) => {
        clearDraft();
        openPanel([response.data.uuid]);
      },
    });
  };

  return (
    <form
      className="flex flex-col gap-3 border-b border-border px-5 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <h3 className="text-sm font-semibold text-foreground">New note</h3>

      {fixedPart ? (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">{partLabel(fixedPart.eid)}</span>
          {quote ? (
            <span className="font-serif text-[0.9375rem] italic leading-snug text-foreground/90">“{quote.quote}”</span>
          ) : null}
        </div>
      ) : (
        <div role="radiogroup" aria-label="Where the note goes" className="flex flex-col gap-1.5">
          <PlaceOption selected={place === 'statute'} onSelect={() => setPlace('statute')}>
            The whole statute
          </PlaceOption>
          {inViewEid ? (
            <PlaceOption selected={place === 'part'} onSelect={() => setPlace('part')}>
              {partLabel(inViewEid)}, the part in view
            </PlaceOption>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-note-type">Type</Label>
        <Select value={type} onValueChange={(value) => setType(value as StatuteAnnotationType)}>
          <SelectTrigger id="new-note-type" className="w-full">
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
        <Label htmlFor="new-note-body">Note</Label>
        <Textarea
          id="new-note-body"
          value={body}
          maxLength={BODY_MAX}
          rows={4}
          placeholder='For example: Printed "restrain"; our copy reads "restraint". (p62)'
          onChange={(event) => setBody(event.target.value)}
        />
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={clearDraft} disabled={create.isPending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!trimmed || create.isPending}>
          {create.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Save note
        </Button>
      </div>
    </form>
  );
}

function PlaceOption({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
        selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-secondary',
        FOCUS_RING,
      )}
    >
      {children}
    </button>
  );
}
