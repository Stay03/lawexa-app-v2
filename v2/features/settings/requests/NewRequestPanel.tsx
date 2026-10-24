'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { extractApiError } from '@/lib/utils/api-error';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { describedBy, FieldMessage } from '../SettingsForm';
import {
  fieldErrors,
  NOTES_MAX,
  REQUEST_TYPES,
  submitBody,
  TITLE_MAX,
  type DraftField,
  type RequestDraft,
} from './model';
import { useSubmitRequest } from './queries';

const FORM_ID = 'new-request-form';
const EMPTY_DRAFT: RequestDraft = { type: null, title: '', notes: '' };

/**
 * NewRequestPanel — ask the research team for a case or a note. The fields are
 * v1's (`components/content-requests/ContentRequestDialog.tsx`): the kind, a
 * title, and optional notes.
 *
 * The server decides what is valid. A 422 puts each message under its own
 * field, in the server's words; a message for a field the form does not have
 * and every other refusal go under the form. On success the panel closes and
 * the request is already the top row of the list behind it (`useSubmitRequest`).
 *
 * The caller keys it per opening (`useUrlOverlay().keyFor`), so a second
 * opening starts empty without an effect resetting it.
 */
export function NewRequestPanel({
  open,
  onOpenChange,
  viewerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewerId: number | null;
}) {
  const submit = useSubmitRequest(viewerId);
  const [draft, setDraft] = useState<RequestDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Partial<Record<DraftField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const body = submitBody(draft);
  const typed = draft.title.trim() !== '' || draft.notes.trim() !== '';
  const sending = submit.isPending;

  const edit = (field: DraftField, next: Partial<RequestDraft>) => {
    setDraft((previous) => ({ ...previous, ...next }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: undefined }));
    if (formError) setFormError(null);
  };

  const send = () => {
    if (!body || sending) return;
    setErrors({});
    setFormError(null);
    submit.mutate(body, {
      onSuccess: () => onOpenChange(false),
      onError: (failure) => {
        const apiError = extractApiError(failure);
        if (apiError.status === 422 && apiError.errors) {
          const mapped = fieldErrors(apiError.errors);
          setErrors(mapped.fields);
          setFormError(mapped.other);
          return;
        }
        setFormError(
          apiError.status === 403
            ? 'Requests need a Lawexa account. Create one, then ask again.'
            : apiError.status === 429
              ? 'Slow down a moment, then try again.'
              : apiError.message,
        );
      },
    });
  };

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="New request"
      description="Tell us what you could not find. Our research team reviews every request, and this page shows where yours is."
      size="content"
      guardUnsaved={typed}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          {/* Outside the form in the DOM; `form=` ties it back, so Enter in
              the title and this button send the same way. */}
          <Button type="submit" form={FORM_ID} disabled={!body || sending}>
            {sending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Send request
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <fieldset
          className="space-y-2"
          aria-describedby={describedBy('request-type-error', 'request-type-hint', errors.type)}
        >
          <legend className="text-sm leading-none font-medium">What do you need?</legend>
          <div className="grid grid-cols-2 gap-2 pt-2">
            {REQUEST_TYPES.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'v2-interactive flex h-11 cursor-pointer items-center justify-center rounded-xl border text-[15px] font-medium',
                  'transition-colors duration-150 motion-reduce:transition-none',
                  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                  draft.type === option.value
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
                  errors.type && draft.type !== option.value && 'border-destructive/50',
                )}
              >
                <input
                  type="radio"
                  name="request-type"
                  value={option.value}
                  checked={draft.type === option.value}
                  onChange={() => edit('type', { type: option.value })}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
          <FieldMessage errorId="request-type-error" hintId="request-type-hint" error={errors.type} />
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="request-title">Title</Label>
          <Input
            id="request-title"
            value={draft.title}
            maxLength={TITLE_MAX}
            autoComplete="off"
            placeholder={draft.type === 'note' ? 'e.g. Notes on the Land Use Act' : 'e.g. Okonkwo v State (2020)'}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={describedBy('request-title-error', 'request-title-hint', errors.title, 'A name or a citation is enough.')}
            onChange={(event) => edit('title', { title: event.target.value })}
          />
          <FieldMessage
            errorId="request-title-error"
            hintId="request-title-hint"
            error={errors.title}
            hint="A name or a citation is enough."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="request-notes">
            Anything else? <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="request-notes"
            value={draft.notes}
            maxLength={NOTES_MAX}
            placeholder="The court, the year, or where you saw it cited"
            className="min-h-24 resize-y"
            aria-invalid={errors.additional_notes ? true : undefined}
            aria-describedby={describedBy('request-notes-error', 'request-notes-hint', errors.additional_notes)}
            onChange={(event) => edit('additional_notes', { notes: event.target.value })}
          />
          <FieldMessage
            errorId="request-notes-error"
            hintId="request-notes-hint"
            error={errors.additional_notes}
          />
        </div>

        {formError ? (
          <p
            role="alert"
            className="text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {formError}
          </p>
        ) : null}
      </form>
    </ResponsiveOverlay>
  );
}
