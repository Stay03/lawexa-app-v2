'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Users } from 'lucide-react';

import type { Space } from '@/types/collab';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { clearScreenContext, setScreenContext, type ScreenAction } from '@/v2/shell/screen-context';
import { useTabTitle } from '@/v2/shell/use-tab-title';
import { SpaceJoinAction } from '../discover/SpaceJoinAction';
import { SPACE_PAGE_COLUMN } from './lobby-parts';

const NO_ACTIONS: readonly ScreenAction[] = [];

/**
 * A public Space's page for a signed-in reader who is not in it (Lucy's walk,
 * 16 November 2026): what the Discover card says about it, and Join. It used
 * to be "You're not in this space", which sent them back to Find a space to
 * join what they were already looking at. The server sends this card and no
 * content (`isSpacePreview`); a private Space still refuses with 403, and the
 * refusal panel stays for it.
 *
 * Joining re-reads the Space, which then comes back whole, and the lobby
 * replaces this page where it stands.
 */
export function SpacePreview({ space }: { space: Space }) {
  const pathname = usePathname();
  useTabTitle(space.name);
  useEffect(() => {
    setScreenContext({ pathname, back: null, actions: NO_ACTIONS, crumb: '' });
  }, [pathname]);
  useEffect(() => () => clearScreenContext(), []);

  const people = space.active_members_count;

  return (
    <div className={SPACE_PAGE_COLUMN}>
      <div className="mx-auto w-full max-w-xl pt-4 md:pt-10">
        <div className="flex items-start gap-4">
          <SpaceCrest uuid={space.uuid} name={space.name} type={space.type} size="lg" />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-balance text-foreground md:text-2xl">{space.name}</h1>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              <Users aria-hidden className="size-4 shrink-0" />
              <span className="truncate">
                {people} {people === 1 ? 'person' : 'people'}
                {space.type_label ? ` · ${space.type_label}` : ''}
                {space.owner?.name ? ` · by ${space.owner.name}` : ''}
              </span>
            </p>
          </div>
        </div>
        {space.description ? (
          <p className="mt-5 text-[15px] leading-relaxed whitespace-pre-line text-foreground/90">{space.description}</p>
        ) : null}
        <p className="mt-5 text-sm text-muted-foreground">Join to see its chats, folders and files and take part.</p>
        <SpaceJoinAction
          className="mt-4"
          space={{ uuid: space.uuid, kind: space.kind, my_status: space.my_status ?? null }}
        />
      </div>
    </div>
  );
}
