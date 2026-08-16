'use client';

import { useId, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import type { User } from '@/types/auth';
import { initialsOf } from '../identity';
import { useRemoveAvatar, useUploadAvatar } from './mutations';

/**
 * ProfileHero: who this is, and the one control that changes it.
 *
 * ── THE SHAPE IS ChatGPT'S, BY THE OWNER'S REFERENCE ───────────────────────
 * The third screenshot he sent opens its profile screen with a large centred
 * avatar carrying a small edit badge, the name under it, and the grouped blocks
 * below. That is what this is. v1's equivalent was a bordered card titled
 * "Profile Overview" with the avatar on the left, two badges, a "Change avatar"
 * button, a bin icon, and the subtitle "Your professional profile information",
 * which is a heading, a description and three controls to say one thing.
 *
 * ── WHAT WAS KEPT FROM v1, AND WHAT WAS FIXED ──────────────────────────────
 * Kept: the upload, the removal, and the 2MB ceiling.
 *
 * Fixed: the ceiling used to be enforced with `window.alert`, a blocking system
 * dialog with the browser's own wording, which is the only one of its kind left
 * in this product. It is now a sentence under the avatar, in the app's voice,
 * and it says the limit rather than only that the limit was passed. The two
 * failures the SERVER can report are shown the same way, in the server's own
 * words, because "Failed to upload avatar. Please try again." (v1's toast) is
 * what you write when you have thrown away what the server told you.
 *
 * The two badges (user type, profession) did not come across. They restate two
 * rows the form itself carries, twenty pixels lower, and neither is editable
 * where it was drawn.
 */

/** The backend's own ceiling, mirrored. */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export function ProfileHero({ user }: { user: User }) {
  const inputId = useId();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();
  /** A refusal this browser made on its own, before any request. */
  const [rejection, setRejection] = useState<string | null>(null);

  const busy = uploadAvatar.isPending || removeAvatar.isPending;
  const failure = uploadAvatar.error ?? removeAvatar.error;
  const message = rejection ?? (failure ? extractApiError(failure).message : null);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared immediately so choosing the SAME file again still fires a change.
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setRejection('Choose an image file.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setRejection('That image is over 2MB. Choose a smaller one.');
      return;
    }
    setRejection(null);
    uploadAvatar.mutate(file);
  };

  return (
    <div className="flex flex-col items-center gap-3 pb-6 text-center">
      <div className="relative">
        <Avatar className="size-24 ring-1 ring-border">
          {/* Empty alt: the name is printed directly underneath, so a described
              face would be the same words twice. */}
          <AvatarImage src={user.avatar_url ?? undefined} alt="" />
          <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
            {initialsOf(user.name)}
          </AvatarFallback>
        </Avatar>

        {busy ? (
          <span
            aria-hidden
            className="absolute inset-0 grid place-items-center rounded-full bg-background/70 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
          >
            <Loader2 className="size-5 animate-spin text-foreground motion-reduce:animate-none" />
          </span>
        ) : null}

        {/* A real file input with a real label: the label is the affordance and
            the input keeps its own keyboard focus, which a hidden input driven
            by a button's ref does not. `peer` carries the focus ring across. */}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={handleFile}
          className="peer sr-only"
        />
        <label
          htmlFor={inputId}
          className="v2-interactive absolute right-0 bottom-0 grid size-8 cursor-pointer place-items-center rounded-full border-2 border-background bg-secondary text-foreground shadow-sm transition-colors duration-150 hover:bg-foreground/10 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-60 motion-reduce:transition-none"
        >
          <Camera aria-hidden className="size-4" />
          <span className="sr-only">Change your photo</span>
        </label>
      </div>

      <div className="space-y-0.5">
        <p className="text-lg leading-snug font-semibold text-foreground">
          {user.name}
        </p>
        {user.email ? (
          <p className="text-[13px] leading-snug text-muted-foreground">
            {user.email}
          </p>
        ) : null}
        <p className="text-[12px] leading-snug text-muted-foreground">
          {memberSince(user.created_at)}
        </p>
      </div>

      {user.avatar_url ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setRejection(null);
            removeAvatar.mutate();
          }}
        >
          Remove photo
        </Button>
      ) : null}

      {message ? (
        <p
          role="alert"
          className="max-w-sm text-[13px] leading-snug text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

/**
 * "Member since March 2025", or nothing sayable.
 *
 * The locale is PINNED rather than left to the reader's, because this string is
 * rendered on the server as well as in the browser and the two machines do not
 * agree on a default. A month name that differs between them is a hydration
 * error, and it is one of the quieter ones to find.
 */
function memberSince(createdAt: string | undefined): string {
  if (!createdAt) return '';
  const parsed = Date.parse(createdAt);
  if (Number.isNaN(parsed)) return '';
  const when = new Date(parsed).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
  return `Member since ${when}`;
}
