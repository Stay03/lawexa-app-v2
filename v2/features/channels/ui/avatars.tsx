import type { ComponentType } from 'react';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogoMark } from '@/v2/shell/Logo';

/**
 * avatars — the channel feature's author marks. No green presence dots on
 * avatars, ever: presence is a quiet count in the header only (design-research
 * DIRECTION 7, binding). Phase-5 W2, 2026-08-04.
 *
 * `MemberAvatar` IS RE-EXPORTED, NOT REDEFINED (W5). W2 shipped its own copy
 * because `v2/features/channels/**` and the spaces/organizations surfaces were
 * owned by parallel waves and neither could edit the other's tree; the two
 * copies were identical. That constraint is gone, the component now lives in
 * the shared collab home with the rest of the membership kit, and this line
 * keeps every consumer's single `../ui/avatars` import working.
 *
 * ── LAWEXA WEARS ITS OWN FACE (owner, 2026-08-06) ──────────────────────────
 * Every surface that means "this is Lawexa" used a lucide Sparkles — the
 * generic AI star every product on the internet is currently wearing. The
 * brand mark existed the whole time, inlined and instant in `v2/shell/Logo`,
 * and it says the one thing a star cannot: WHICH assistant this is. One
 * definition lives here ({@link LawexaMark}) and every channel surface draws
 * it, so the identity cannot drift a seventh time.
 */

export { MemberAvatar } from '@/v2/features/collab/membership/MemberAvatar';

/**
 * The Lawexa mark at TEXT scale — the inline "this is Lawexa" glyph, for a
 * badge, a menu row, a panel heading, a responding line.
 *
 * It is an `<img>`, not an icon font, so two things a lucide icon gives free
 * have to be given here: the size is explicit (a `[&>svg]` rule in a Badge
 * cannot reach it) and it takes no `currentColor`, which is why the gold mark
 * is used as-is rather than tinted to `text-primary` at each call site.
 *
 * `alt=""` by default: every place this appears, the word "Lawexa" is already
 * beside it or the control carries its own label, so naming the brand again
 * would make a screen reader say it twice.
 */
export function LawexaMark({
  className,
  alt = '',
}: {
  className?: string;
  /** Only set this where no sibling text names Lawexa. */
  alt?: string;
  /** Accepted so this can stand in an icon slot that hides its glyph. Nothing
   *  is done with it on purpose: `alt=""` is how an `<img>` says the same
   *  thing, and it is already the default here. */
  'aria-hidden'?: boolean;
}) {
  return <LogoMark alt={alt} className={cn('size-4 rounded-[3px]', className)} />;
}

/**
 * What an icon slot needs to accept once the mark can fill it. Every
 * `LucideIcon` satisfies it, so widening a slot to this takes nothing away.
 */
export type MarkComponent = ComponentType<{
  className?: string;
  'aria-hidden'?: boolean;
}>;

/** Branded avatar for Lawexa (`is_ai`) author runs — the brand mark on the
 *  gold tint, matching `MemberAvatar`'s size/className shape. */
export function LawexaAvatar({
  size = 'default',
  className,
}: {
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback className="bg-primary/10">
        <LawexaMark className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}
