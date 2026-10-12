'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { inviteUrl } from './link-model';

/**
 * The one control that copies an invite's address, and the field that shows
 * it. The address and the sentence about it are composed in `./link-model`,
 * which has no JSX, so the tests can pin them.
 */

/**
 * Copy, with its own confirmation.
 *
 * THE CLIPBOARD WRITE HAPPENS INSIDE THE CLICK, never after an `await`: iOS
 * refuses a write that has lost the user gesture, and the failure is silent.
 */
export function CopyLinkButton({
  code,
  variant = 'ghost',
  size = 'sm',
  className,
}: {
  code: string;
  variant?: 'ghost' | 'outline' | 'secondary';
  /** `default` stands at an `Input`'s height, beside the link field. */
  size?: 'sm' | 'default';
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        void navigator.clipboard?.writeText(inviteUrl(code));
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? (
        <>
          <Check aria-hidden className="size-4" /> Copied
        </>
      ) : (
        <>
          <Copy aria-hidden className="size-4" /> Copy
        </>
      )}
    </Button>
  );
}

/**
 * The address itself, in a read-only field at the email field's height and
 * radius, so the invite dialog and the links panel show a link one way: the
 * full address, with Copy beside it (design round 1). It used to be a 28px
 * code chip with 4px corners in the dialog and a bare `/join/{code}` in the
 * panel. Focusing it selects the whole address, for anyone who copies by hand.
 */
export function InviteLinkField({
  code,
  dead = false,
}: {
  code: string;
  /** A revoked or used-up link: struck through, and no Copy. */
  dead?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Input
        readOnly
        aria-label="Invite link"
        value={inviteUrl(code)}
        onFocus={(event) => event.currentTarget.select()}
        className={cn(
          'min-w-0 flex-1 font-mono text-xs md:text-xs',
          dead && 'text-muted-foreground line-through',
        )}
      />
      {dead ? null : (
        <CopyLinkButton code={code} variant="outline" size="default" className="shrink-0" />
      )}
    </div>
  );
}
