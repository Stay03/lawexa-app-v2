'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ImagePlus, Loader2, MessageSquarePlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';

import { cn } from '@/lib/utils';
import { feedbackApi } from '@/lib/api/feedback';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { FeedbackContentType } from '@/types/feedback';
import { getErrorMessage } from '@/v2/runtime/query';
import { useV2Session } from '@/v2/runtime/session-context';
import { ACTION_PILL, FOCUS_RING } from '@/v2/shell/designs/modules';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX_PICTURES,
  FEEDBACK_NOUN,
  FEEDBACK_PICTURE_ACCEPT,
  FEEDBACK_TEXT_MAX,
  canSendFeedback,
  feedbackFailureText,
  feedbackText,
  pictureRefusal,
} from './feedback-model';
import { useFeedbackBreakpoint } from './use-feedback-breakpoint';

/**
 * FeedbackButton — "Give feedback" on a case, a statute or a note (v2 Stage
 * 1, item 5). ONE button and ONE form for all three, so a change here applies
 * to every page (Stay, 18 October 2026): the issues to tick come from
 * `feedback-model.ts` by type, the report goes to v1's `POST /feedback`.
 *
 * A pill in the page's action row, at the weight of Save and Share, because
 * it is something you do to the document. The form is a centred dialog on a
 * wide screen and a bottom sheet on a phone (`useFeedbackBreakpoint`); it
 * mounts only once pressed.
 *
 * WHAT THE FORM ASKS. The issues for this type, any number of them, then the
 * reader's own words (up to 4,500 characters) and up to four pictures (5 MB
 * each, JPG, PNG, GIF or WebP), as v1 takes them. Sending needs an issue or
 * some words; an empty report is refused in place. A refused send keeps
 * everything typed and says why under the button; a sent one closes with a
 * thank-you.
 */
export function FeedbackButton({
  type,
  contentId,
}: {
  type: FeedbackContentType;
  /** The case's, statute's or note's own id. */
  contentId: number;
}) {
  const [open, setOpen] = useState(false);
  // An account's report only: the server refuses a guest pass's (403), so a
  // guest is not offered the button (`canSendFeedback`).
  const session = useV2Session();
  if (!canSendFeedback(session)) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(ACTION_PILL, FOCUS_RING)}>
        <MessageSquarePlus aria-hidden className="size-4" />
        Feedback
      </button>
      {open ? (
        <FeedbackFrame
          title={`Feedback on this ${FEEDBACK_NOUN[type]}`}
          description="Tell us what is wrong, or what works. The team reads every report."
          onClose={() => setOpen(false)}
        >
          <FeedbackForm type={type} contentId={contentId} onSent={() => setOpen(false)} />
        </FeedbackFrame>
      ) : null}
    </>
  );
}

/**
 * The dialog or the sheet, whichever the width calls for, around one form.
 * Shared with a quiz question's report (`QuestionFeedbackButton`).
 */
export function FeedbackFrame({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const wide = useFeedbackBreakpoint();
  const change = (next: boolean) => {
    if (!next) onClose();
  };
  if (wide === null) return null;
  const form = children;
  if (wide) {
    return (
      <Dialog open onOpenChange={change}>
        <DialogContent className="max-h-[90svh] gap-4 overflow-y-auto sm:max-w-lg">
          <DialogHeader className="pr-8">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open onOpenChange={change}>
      <SheetContent side="bottom" className="v2-safe-bottom max-h-[90svh] gap-0 overflow-y-auto rounded-t-2xl px-5 pt-5 pb-6">
        <SheetHeader className="gap-1 p-0 pb-4 pr-10">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {form}
      </SheetContent>
    </Sheet>
  );
}

function FeedbackForm({
  type,
  contentId,
  onSent,
}: {
  type: FeedbackContentType;
  contentId: number;
  onSent: () => void;
}) {
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const [details, setDetails] = useState('');
  const [pictures, setPictures] = useState<readonly File[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const send = useMutation({
    mutationFn: (text: string) =>
      feedbackApi.submit({
        feedback_text: text,
        content_type: type,
        content_id: contentId,
        attachments: pictures.length > 0 ? [...pictures] : undefined,
      }),
    // The form is on screen and says what went wrong itself.
    meta: { silentError: true },
  });

  const toggle = (id: string, on: boolean) => {
    setProblem(null);
    setTicked((current) => (on ? [...current, id] : current.filter((value) => value !== id)));
  };

  const addPictures = (files: FileList | null) => {
    if (!files) return;
    const refused: string[] = [];
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      const why = pictureRefusal(file);
      if (why) refused.push(why);
      else accepted.push(file);
    }
    const room = FEEDBACK_MAX_PICTURES - pictures.length;
    if (accepted.length > room) refused.push(`A report can carry ${FEEDBACK_MAX_PICTURES} pictures.`);
    setPictures((current) => [...current, ...accepted.slice(0, Math.max(room, 0))]);
    setProblem(refused.length > 0 ? refused.join(' ') : null);
  };

  const submit = () => {
    if (send.isPending) return;
    const text = feedbackText(type, ticked, details);
    if (!text) {
      setProblem('Tick an issue or tell us in your own words.');
      return;
    }
    setProblem(null);
    send.mutate(text, {
      onSuccess: () => {
        toast.success('Feedback sent', { description: 'Thank you for helping us improve Lawexa.' });
        onSent();
      },
      // No answer at all (offline, a dropped connection) is not the server's
      // word, so it is said plainly; a refusal keeps the server's own words.
      onError: (error) => setProblem(sendFailure(error)),
    });
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <IssueChecklist
        legend="What is it about?"
        categories={FEEDBACK_CATEGORIES[type]}
        ticked={ticked}
        onToggle={toggle}
      />

      <DetailsField
        value={details}
        max={FEEDBACK_TEXT_MAX}
        placeholder="What did you expect, and what happened?"
        onChange={(next) => {
          setProblem(null);
          setDetails(next);
        }}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-foreground">
            Pictures <span className="font-normal text-muted-foreground">(optional, up to {FEEDBACK_MAX_PICTURES})</span>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pictures.length >= FEEDBACK_MAX_PICTURES}
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus aria-hidden className="size-4" />
            Add
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept={FEEDBACK_PICTURE_ACCEPT}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              addPictures(event.target.files);
              event.target.value = '';
            }}
          />
        </div>
        {pictures.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {pictures.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex max-w-full items-center gap-1 rounded-full border border-border py-1 pl-3 pr-1 text-xs text-foreground"
              >
                <span className="min-w-0 truncate">{file.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setPictures((current) => current.filter((_, at) => at !== index))}
                  className={cn('v2-interactive flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground', FOCUS_RING)}
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={send.isPending} className="w-full sm:w-auto sm:self-end">
          {send.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Send feedback
        </Button>
        {problem ? (
          <p role="alert" className="text-sm text-destructive sm:text-right">
            {problem}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** The issues to tick, any number of them. Shared with a quiz question's report. */
export function IssueChecklist({
  legend,
  categories,
  ticked,
  onToggle,
}: {
  legend: string;
  categories: readonly { id: string; label: string }[];
  ticked: readonly string[];
  onToggle: (id: string, on: boolean) => void;
}) {
  const ids = useId();
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-2 text-sm font-medium text-foreground">{legend}</legend>
      {categories.map((category) => {
        const id = `${ids}-${category.id}`;
        return (
          <label
            key={category.id}
            htmlFor={id}
            className="v2-interactive flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-secondary/60"
          >
            <Checkbox
              id={id}
              checked={ticked.includes(category.id)}
              onCheckedChange={(state) => onToggle(category.id, state === true)}
            />
            {category.label}
          </label>
        );
      })}
    </fieldset>
  );
}

/** The reader's own words, with the count against the limit. Shared with a quiz question's report. */
export function DetailsField({
  value,
  max,
  placeholder,
  onChange,
}: {
  value: string;
  max: number;
  placeholder: string;
  onChange: (next: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        In your own words <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <Textarea
        id={id}
        value={value}
        maxLength={max}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="text-base sm:text-sm"
      />
      <p className="self-end text-xs tabular-nums text-muted-foreground">
        {value.length.toLocaleString()} / {max.toLocaleString()}
      </p>
    </div>
  );
}

/** A refused or lost send in words (`feedbackFailureText`). Shared with a quiz question's report. */
export function sendFailure(error: unknown): string {
  return feedbackFailureText({
    offline: isAxiosError(error) && !error.response,
    status: isAxiosError(error) ? (error.response?.status ?? null) : null,
    serverMessage: getErrorMessage(error),
  });
}
