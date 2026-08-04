'use client';

import { useState } from 'react';

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

/**
 * LinkDialog — adding a link, without `window.prompt`.
 *
 * v1 called `window.prompt('Enter URL', …)`. A native prompt is unstyled,
 * untranslatable, blocks the whole tab, is suppressed outright in some
 * embedded browsers, and cannot say what is wrong with what you typed. This is
 * the same interaction as a real dialog: it opens with the existing href when
 * there is one, it normalises a bare domain into a URL, and it refuses
 * something unusable IN PLACE rather than accepting it and producing a dead
 * link.
 *
 * ONE DIALOG FOR BOTH TOOLBARS. The desktop bubble and the touch dock bar both
 * open this, so a link is added the same way on every device — and on touch, a
 * dialog is the only sane answer anyway (there is no bubble to host an inline
 * field).
 */

/** Prefix a bare domain, then check the result is a URL we would follow. */
export function normalizeLinkHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    // http/https only: `javascript:` and `data:` in an author-controlled link
    // are the classic stored-XSS vector, and mailto/tel are not what this field
    // is for.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function LinkDialog({
  open,
  initialHref,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  /** The href already on the selection, if any — the field opens with it. */
  initialHref: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (href: string) => void;
}) {
  const [value, setValue] = useState(initialHref);
  const [seenHref, setSeenHref] = useState(initialHref);
  const [invalid, setInvalid] = useState(false);

  // Render-phase reset (the house pattern): re-opening on a different selection
  // re-seeds the field without a `setState` inside an effect.
  if (initialHref !== seenHref) {
    setSeenHref(initialHref);
    setValue(initialHref);
    setInvalid(false);
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const href = normalizeLinkHref(value);
    if (href === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onSubmit(href);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Add a link</DialogTitle>
            <DialogDescription>
              The selected text becomes a link to this address.
            </DialogDescription>
          </DialogHeader>

          <div className="my-5 space-y-2">
            <Label htmlFor="v2-note-link-url">Web address</Label>
            <Input
              id="v2-note-link-url"
              type="text"
              inputMode="url"
              autoComplete="off"
              autoFocus
              placeholder="example.com/page"
              value={value}
              aria-invalid={invalid}
              aria-describedby={invalid ? 'v2-note-link-error' : undefined}
              onChange={(event) => {
                setValue(event.target.value);
                if (invalid) setInvalid(false);
              }}
            />
            {invalid ? (
              <p
                id="v2-note-link-error"
                className="text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
              >
                That doesn&apos;t look like a web address. Try something like
                example.com/page.
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Add link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
