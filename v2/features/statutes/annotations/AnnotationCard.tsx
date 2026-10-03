'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { formatUsageDate } from '@/v2/features/settings/usage/model';
import {
  ANNOTATION_BODY_MAX,
  ANNOTATION_COLOURS,
  DEFAULT_ANNOTATION_COLOUR,
  colourOf,
  isPending,
  type AnnotationColour,
  type ReaderAnnotation,
} from './model';

/**
 * The card beside an annotation's words: writing a new one (colour and an
 * optional note, then Save), or opening a saved one (its note, its date, and
 * Colour, Edit, Delete). A new one starts in the default colour, so Save
 * alone is enough; the reader can pick another before or after saving
 * (Stay, 3 October 2026). On a phone it is a sheet along the bottom
 * edge; wider, it sits under the words, kept on screen.
 *
 * Escape or a press outside closes it. Delete asks first, in the card.
 */

const WIDTH = 340;
const MARGIN = 12;
const PHONE = 640;

const SWATCH: Record<AnnotationColour, string> = {
  yellow: 'bg-[#facc15]',
  green: 'bg-[#4ade80]',
  blue: 'bg-[#60a5fa]',
  pink: 'bg-[#f472b6]',
  purple: 'bg-[#c084fc]',
};

const COLOUR_NAME: Record<AnnotationColour, string> = {
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  pink: 'Pink',
  purple: 'Purple',
};

export type AnnotationCardState =
  | { readonly mode: 'create'; readonly rect: DOMRect }
  | { readonly mode: 'view'; readonly rect: DOMRect; readonly annotation: ReaderAnnotation };

export function AnnotationCard({
  state,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  state: AnnotationCardState;
  onClose: () => void;
  onCreate: (body: string, colour: AnnotationColour) => void;
  onUpdate: (uuid: string, change: { body?: string; colour?: AnnotationColour }) => void;
  onDelete: (uuid: string) => void;
}) {
  const saved = state.mode === 'view' ? state.annotation : null;
  const [editing, setEditing] = useState(state.mode === 'create');
  const [picking, setPicking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [colour, setColour] = useState<AnnotationColour>(saved ? colourOf(saved) : DEFAULT_ANNOTATION_COLOUR);
  const [body, setBody] = useState(saved?.body ?? '');
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPress = (event: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPress);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPress);
    };
  }, [onClose]);

  const phone = window.innerWidth < PHONE;
  const below = state.rect.bottom + 10;
  const place = phone
    ? undefined
    : {
        left: Math.min(Math.max(MARGIN, state.rect.left), window.innerWidth - WIDTH - MARGIN),
        top: below + 260 > window.innerHeight ? Math.max(MARGIN, state.rect.top - 270) : below,
        width: WIDTH,
      };

  const pickColour = (next: AnnotationColour) => {
    setColour(next);
    if (saved && !editing) {
      onUpdate(saved.uuid, { colour: next });
      setPicking(false);
    }
  };

  const save = () => {
    const text = body.trim();
    if (saved) onUpdate(saved.uuid, { body: text, colour });
    else onCreate(text, colour);
    onClose();
  };

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={saved ? 'Your annotation' : 'New annotation'}
      style={place}
      className={cn(
        'fixed z-50 flex flex-col gap-3 border border-border bg-background p-4 text-foreground shadow-xl',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150',
        phone ? 'inset-x-0 bottom-0 rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]' : 'rounded-2xl',
      )}
    >
      {editing || picking ? (
        <div role="radiogroup" aria-label="Colour" className="flex gap-2.5">
          {ANNOTATION_COLOURS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={colour === option}
              aria-label={COLOUR_NAME[option]}
              onClick={() => pickColour(option)}
              className={cn(
                'v2-interactive size-6 rounded-full',
                SWATCH[option],
                colour === option && 'outline outline-2 outline-offset-2 outline-foreground',
                FOCUS_RING,
              )}
            />
          ))}
        </div>
      ) : null}

      {editing ? (
        <>
          <Textarea
            autoFocus
            value={body}
            maxLength={ANNOTATION_BODY_MAX}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add a note (optional). Leave it empty for a plain highlight."
            className="min-h-20 resize-none text-[14px]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={save}>
              Save
            </Button>
          </div>
        </>
      ) : saved ? (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-[12px] text-muted-foreground">Your annotation</p>
            {saved.body ? (
              <p className="whitespace-pre-wrap text-[14px] leading-snug">{saved.body}</p>
            ) : (
              <p className="text-[14px] text-muted-foreground">A highlight, with no note.</p>
            )}
            <p className="text-[12px] text-muted-foreground">
              {formatUsageDate(saved.created_at)}
            </p>
          </div>
          {confirming ? (
            <div className="flex items-center justify-end gap-2">
              <span className="mr-auto text-[13px]">Delete this annotation?</span>
              <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
                Keep
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onDelete(saved.uuid);
                  onClose();
                }}
              >
                Delete
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" disabled={isPending(saved)} onClick={() => setPicking((open) => !open)}>
                Colour
              </Button>
              <Button variant="outline" size="sm" disabled={isPending(saved)} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="outline" size="sm" disabled={isPending(saved)} onClick={() => setConfirming(true)}>
                Delete
              </Button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
