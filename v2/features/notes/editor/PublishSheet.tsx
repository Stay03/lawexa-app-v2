'use client';

import { useState, type KeyboardEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Globe, Lock, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { VisibilityOption } from '@/v2/features/sharing/VisibilityOption';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { notesApi } from '../api';
import type { NotePublishInput, NoteRecord } from '../types';

/**
 * PublishSheet — publish a note, from the v2 editor.
 *
 * Publishing was carved out of v2 with the marketplace, so a note written in v2
 * stayed private and could only be published by switching to classic Lawexa.
 * Ambassadors reported it (Arthur, 25 September 2026) and the owner said "add
 * the button". The fields are v1's publish page, no more: who can read it, tags,
 * and a price for an account allowed to sell (a creator or an admin).
 *
 * ── A DRAFT UNTIL PUBLISH ─────────────────────────────────────────────────
 * `null` means untouched, exactly as in `OptionPicker`: the sheet shows the
 * saved note until something is changed, and closing drops the edits in the
 * close handler rather than in an effect. Publish sends ONE request, through
 * the same `PUT /notes/{id}` a save uses.
 *
 * ── WHAT IS PUBLISHED IS WHAT IS ON SCREEN ────────────────────────────────
 * The editor's Publish button is on only while autosave is `clean`, so the
 * note that goes out is the note the author is looking at, never the version
 * from a few keystrokes ago.
 */

const MAX_TAGS = 10;
/** v1's limit; the API allows 100, so a v1 and a v2 tag fit the same box. */
const MAX_TAG_LENGTH = 50;
/** The API's defaults (`lawexa.max_note_price_ngn`, and 10,000 for USD). */
const MAX_NGN = 100_000;
const MAX_USD = 10_000;

interface PublishDraft {
  isPublic: boolean;
  tags: string[];
  tagInput: string;
  isPaid: boolean;
  priceNgn: string;
  hasUsd: boolean;
  priceUsd: string;
}

/** A price as the API sends it ("1500.00", a number, or nothing). */
function priceOf(value: string | number | null | undefined): number {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : (value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function draftFrom(record: NoteRecord): PublishDraft {
  const ngn = priceOf(record.price_ngn);
  const usd = priceOf(record.price_usd);
  return {
    // The sheet opens on what the server holds. A note created in v2 comes back
    // from the server PUBLIC (`is_private: false`, measured on lawexa.com on 25
    // September 2026), so a first publish opens on "Anyone", as v1's publish
    // page did. A record without the field opens on "Only you".
    isPublic: record.is_private === false,
    tags: record.tags ?? [],
    tagInput: '',
    isPaid: ngn > 0 || usd > 0,
    priceNgn: ngn > 0 ? String(ngn) : '',
    hasUsd: usd > 0,
    priceUsd: usd > 0 ? String(usd) : '',
  };
}

export function PublishSheet({
  open,
  onOpenChange,
  record,
  canSetPrice,
  onPublished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: NoteRecord;
  /** A creator or an admin (the session's `canSetPrice`). */
  canSetPrice: boolean;
  /** The saved note, as the API returned it. */
  onPublished: (next: NoteRecord) => void;
}) {
  const [draft, setDraft] = useState<PublishDraft | null>(null);
  const current = draft ?? draftFrom(record);
  const isPublished = record.status === 'published';

  const change = (patch: Partial<PublishDraft>) => setDraft({ ...current, ...patch });

  const handleOpenChange = (next: boolean) => {
    if (!next) setDraft(null);
    onOpenChange(next);
  };

  const save = useMutation({
    mutationFn: (input: NotePublishInput) => notesApi.publish(record.id, input),
    meta: { silentError: true },
  });

  // ── Validation, in the words the author sees ──────────────────────────
  const ngn = Number.parseFloat(current.priceNgn);
  const usd = Number.parseFloat(current.priceUsd);
  const pricing = canSetPrice && current.isPaid;
  const ngnError = !pricing
    ? null
    : !(ngn > 0)
      ? 'Enter a price above ₦0.'
      : ngn > MAX_NGN
        ? `The most a note can cost is ₦${MAX_NGN.toLocaleString()}.`
        : null;
  const usdError =
    !pricing || !current.hasUsd
      ? null
      : !(usd > 0)
        ? 'Enter a price above $0.'
        : usd > MAX_USD
          ? `The most a note can cost is $${MAX_USD.toLocaleString()}.`
          : null;
  const invalid = ngnError !== null || usdError !== null;

  const addTag = () => {
    const tag = current.tagInput.trim();
    if (!tag || current.tags.length >= MAX_TAGS) return;
    if (current.tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      change({ tagInput: '' });
      return;
    }
    change({ tags: [...current.tags, tag.slice(0, MAX_TAG_LENGTH)], tagInput: '' });
  };

  const onTagKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag();
    }
  };

  const submit = (status: NotePublishInput['status']) => {
    if (invalid || save.isPending) return;
    // A tag still in the box counts: nobody expects Publish to drop it.
    const pending = current.tagInput.trim();
    const tags =
      pending && current.tags.length < MAX_TAGS && !current.tags.includes(pending)
        ? [...current.tags, pending.slice(0, MAX_TAG_LENGTH)]
        : current.tags;
    const input: NotePublishInput = { status, is_private: !current.isPublic, tags };
    if (canSetPrice) {
      input.price_ngn = pricing ? ngn : null;
      input.price_usd = pricing && current.hasUsd ? usd : null;
    }
    save.mutate(input, {
      onSuccess: (response) => {
        onPublished(response.data);
        toast.success(
          status === 'published'
            ? isPublished
              ? 'Note updated'
              : 'Note published'
            : isPublished
              ? 'Note unpublished'
              : 'Saved as a draft',
        );
        handleOpenChange(false);
      },
      onError: (error) => toast.error(extractApiError(error).message),
    });
  };

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={handleOpenChange}
      title={isPublished ? 'Published note' : 'Publish note'}
      description="Choose who can read this note and add tags so readers can find it."
      size="content"
      footer={
        <div className="flex gap-2.5">
          {isPublished ? (
            <Button
              type="button"
              variant="secondary"
              className="flex-1 md:w-auto md:flex-none"
              disabled={save.isPending}
              onClick={() => submit('draft')}
            >
              Unpublish
            </Button>
          ) : (
            <DialogClose asChild>
              <Button type="button" variant="secondary" className="flex-1 md:w-auto md:flex-none">
                Cancel
              </Button>
            </DialogClose>
          )}
          <Button
            type="button"
            className="flex-1 md:w-auto md:flex-none"
            disabled={invalid || save.isPending}
            onClick={() => submit('published')}
          >
            {isPublished ? 'Update' : 'Publish'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6 pb-2">
        <section className="flex flex-col gap-2" role="group" aria-labelledby="publish-who">
          <h3 id="publish-who" className="text-sm font-medium text-foreground">
            Who can read it
          </h3>
          <VisibilityOption
            icon={Globe}
            title="Anyone"
            description="It appears in the notes library"
            selected={current.isPublic}
            busy={false}
            onSelect={() => change({ isPublic: true })}
          />
          <VisibilityOption
            icon={Lock}
            title="Only you"
            description="Published, but private to you"
            selected={!current.isPublic}
            busy={false}
            onSelect={() => change({ isPublic: false })}
          />
        </section>

        <section className="flex flex-col gap-2">
          <Label htmlFor="publish-tags" className="text-sm font-medium">
            Tags
          </Label>
          <Input
            id="publish-tags"
            value={current.tagInput}
            onChange={(event) => change({ tagInput: event.target.value })}
            onKeyDown={onTagKey}
            onBlur={addTag}
            placeholder={current.tags.length >= MAX_TAGS ? 'Ten tags is the most' : 'Add a tag, then Enter'}
            disabled={current.tags.length >= MAX_TAGS}
            maxLength={MAX_TAG_LENGTH}
            autoComplete="off"
          />
          {current.tags.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Added tags">
              {current.tags.map((tag) => (
                <li
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pr-1 pl-3 text-sm text-primary"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => change({ tags: current.tags.filter((value) => value !== tag) })}
                    aria-label={`Remove tag ${tag}`}
                    className="v2-interactive rounded-full p-1 hover:bg-primary/15"
                  >
                    <X aria-hidden className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {current.tags.length} of {MAX_TAGS}
          </p>
        </section>

        {canSetPrice ? (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor="publish-paid" className="text-sm font-medium">
                  Paid note
                </Label>
                <p className="text-sm text-muted-foreground">
                  {current.isPaid ? 'Readers pay to read it' : 'Free for everyone'}
                </p>
              </div>
              <Switch
                id="publish-paid"
                checked={current.isPaid}
                onCheckedChange={(checked) => change({ isPaid: checked })}
              />
            </div>

            {/* Opens and closes by height, never a jump (the motion rule). */}
            <div
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none',
                current.isPaid ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
              aria-hidden={!current.isPaid}
            >
              <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
                <PriceField
                  id="publish-ngn"
                  label="Price in naira (₦)"
                  value={current.priceNgn}
                  onChange={(value) => change({ priceNgn: value })}
                  error={ngnError}
                  disabled={!current.isPaid}
                />
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <Label htmlFor="publish-usd-on" className="text-sm font-medium">
                      Also set a dollar price
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {current.hasUsd
                        ? 'Readers outside Nigeria pay in dollars'
                        : 'Everyone pays the naira price'}
                    </p>
                  </div>
                  <Switch
                    id="publish-usd-on"
                    checked={current.hasUsd}
                    onCheckedChange={(checked) => change({ hasUsd: checked })}
                    disabled={!current.isPaid}
                  />
                </div>
                {current.hasUsd ? (
                  <PriceField
                    id="publish-usd"
                    label="Price in US dollars ($)"
                    value={current.priceUsd}
                    onChange={(value) => change({ priceUsd: value })}
                    error={usdError}
                    disabled={!current.isPaid}
                  />
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </ResponsiveOverlay>
  );
}

function PriceField({
  id,
  label,
  value,
  onChange,
  error,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={error !== null}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
