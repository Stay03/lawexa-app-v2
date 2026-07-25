'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { contentRequestsApi } from '@/lib/api/content-requests';

/**
 * RequestCaseDialog — "we don't have it; ask us for it".
 *
 * The honest companion to a zero-result search on a FINITE library: "no cases
 * match" usually means the case is not in the library yet, not that the reader
 * typed it wrong. Pre-filled with whatever they searched for, so the whole
 * interaction is one confirm.
 *
 * Two states after submit, both in place: a spinner on the button, then a
 * confirmation that replaces the form rather than a toast that flies past. The
 * request has no follow-up surface in v2 yet, so the confirmation says what
 * happens next instead of pretending there is somewhere to track it.
 *
 * `meta.silentError` is NOT set: a failed submit rides the global mutation error
 * toast, which is the one error channel for every v2 mutation.
 */
export function RequestCaseDialog({
  open,
  onOpenChange,
  defaultTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fills the title — normally the search that found nothing. */
  defaultTitle?: string;
}) {
  const [title, setTitle] = useState(defaultTitle ?? '');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);

  const submit = useMutation({
    mutationFn: () =>
      contentRequestsApi.submit({
        type: 'case',
        title: title.trim(),
        additional_notes: notes.trim() || undefined,
      }),
    onSuccess: () => setDone(true),
  });

  // Reset on close so re-opening never shows the previous request's confirmation.
  const change = (next: boolean) => {
    if (!next) {
      setDone(false);
      setNotes('');
      setTitle(defaultTitle ?? '');
      submit.reset();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-lg">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            >
              <CheckCircle2 className="size-6" />
            </span>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-center">Request sent</DialogTitle>
              <DialogDescription className="text-center">
                Our research team reviews requests and adds the case to the library
                when it is available.
              </DialogDescription>
            </DialogHeader>
            <Button variant="outline" size="sm" onClick={() => change(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Request a case</DialogTitle>
              <DialogDescription>
                Tell us which case you were looking for and we will try to add it.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="request-case-title">Case name or citation</Label>
                <Input
                  id="request-case-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Carlill v Carbolic Smoke Ball Co"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="request-case-notes">Anything else? (optional)</Label>
                <Textarea
                  id="request-case-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Court, year, or where you saw it cited"
                  className="min-h-20 resize-y"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => change(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => submit.mutate()}
                disabled={!title.trim() || submit.isPending}
              >
                {submit.isPending ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : null}
                Send request
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
