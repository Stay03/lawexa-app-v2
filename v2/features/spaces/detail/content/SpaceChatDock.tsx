'use client';

import { useState, type Ref } from 'react';

import { useV2Session } from '@/v2/runtime/session-context';
import {
  HomeComposer,
  type HomeComposerHandle,
  type HomeComposerSpace,
} from '@/v2/shell/designs/HomeComposer';

/** Arthur's words for the box (15 October 2026), the same for a Work and a
 *  Study space: one layout, and here one line of copy too. */
export const SPACE_COMPOSER_PLACEHOLDER = 'How can Lawexa help you with this Space?';

/**
 * The message box at the bottom of a space's home (Stay, 15
 * October 2026: "it should be a text area at the bottom like the chat page and
 * when i click send it should then take me to the normal space chat/message
 * page with lawexa responding"; Arthur: the composer is visible as soon as the
 * space opens, no New conversation button).
 *
 * It is the home's composer with the space attached (`space=`): a send starts
 * the chat IN the space (`space_uuid` on POST /chat) and moves to `/c/{id}`,
 * where Lawexa's answer streams in, as a send from the home does. Private
 * modes are off beside a space, as the composer already rules.
 *
 * DOCKED, AS THE HOME DOCKS ITS BOX: sticky to the bottom of the collab pane
 * (the pane is the scroller, `CollabFrame`'s `data-v2-scroller`), over a fade
 * into the page, so the conversations above scroll under it. `mt-auto` puts it
 * at the bottom of a short list, because the page column is a full-height
 * flex column; `-mb-16` gives back the column's bottom padding so it meets the
 * pane's edge. Nothing on its way up the tree is transformed (a transform
 * would end `position: sticky`).
 *
 * The text is local state: the page is keyed by the space, so a draft never
 * follows the reader into another space, and the home's shared draft key
 * (`useComposerDraft`) is left alone.
 *
 * `handle` is the box's own (`HomeComposerHandle`): the empty list's Upload
 * files opens this box's picker, so the file shows as a chip in the box, saved
 * in the space and sent with the first message (Arthur, 15 October 2026).
 *
 * THE PHONE'S BOX AT EVERY WIDTH (design B4, Arthur, 17 October 2026: "Keep
 * composer consistent"): the text on top and the model at the bottom left. On
 * a desktop it is centred and as wide as the follow-up box on `/c/{id}`
 * (`max-w-md`, the cap that screen's overlay carries), which still answers
 * Stay's 15 October 2026 note ("the text area in the web one is too long and
 * big"); the one-row pill it was there is gone.
 */
export function SpaceChatDock({
  space,
  handle,
}: {
  space: HomeComposerSpace;
  handle?: Ref<HomeComposerHandle>;
}) {
  const session = useV2Session();
  const [value, setValue] = useState('');

  return (
    <div data-space-chat-dock="" className="sticky bottom-0 z-10 -mx-4 -mb-16 mt-auto px-4 pt-6 v2-safe-bottom">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-background via-background/90 to-transparent"
      />
      <div className="pb-3 md:mx-auto md:w-full md:max-w-md">
        <HomeComposer
          value={value}
          onValueChange={setValue}
          signedIn={session.signedIn}
          role={session.role ?? undefined}
          space={space}
          handle={handle}
          placeholder={SPACE_COMPOSER_PLACEHOLDER}
          className="p-2.5 shadow-lg"
          textareaClassName="text-base"
        />
      </div>
    </div>
  );
}
