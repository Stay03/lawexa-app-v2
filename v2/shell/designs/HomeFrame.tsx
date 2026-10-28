'use client';

import type { ReactNode } from 'react';

import type { UserRole } from '@/types/auth';
import { isAccountRole } from '@/v2/runtime/account';
import { useV2Session } from '@/v2/runtime/session-context';
import { HomeComposer } from './HomeComposer';
import { HomeComposerProvider, useHomeComposer } from './home-composer-context';
import { useAskArrival } from './composer/ask-param';
import { HOME_COMPOSER_DOCK, HOME_DOCK_FADE, HOME_FRAME, HOME_FRAME_CONTENT } from './home-frame';

/**
 * HomeFrame — the home layout's body: the tab's content, and under it the ONE
 * chat box Chat, Work and Study share (Stay, 24 October 2026). The layout
 * stays mounted while the reader moves between the three tabs, so only the
 * content changes; the box, its draft, its jurisdiction, its model and its
 * attached files stay where they are.
 *
 * AT THE FOOT OF THE SCREEN, ON EVERY TAB AND WIDTH. The frame is a column at
 * least the screen's height, the content takes the room left, and the dock is
 * `sticky bottom-0` inside the shell's one scroll container, never `fixed`.
 * So a short tab still puts the box at the screen's bottom edge, a long list
 * scrolls behind and above it, its last row stops above it, and on a phone the
 * box rides the keyboard (the shell sizes the scroll container to the visual
 * viewport). Each tab's `loading.tsx` draws inside this layout, so the box is
 * there while a tab loads too.
 *
 * KEYED ON IDENTITY, as the surfaces are (`app/v2/home.tsx`): a guest's draft
 * and switches never carry into an account, and a sign-out drops them.
 */
export function HomeFrame({ children }: { children: ReactNode }) {
  const { signedIn: sessionSignedIn, role, userId } = useV2Session();
  // A guest pass reads the libraries but meets the home as a visitor.
  const signedIn = sessionSignedIn && isAccountRole(role);
  return (
    <HomeComposerProvider key={userId ?? 'visitor'}>
      <div className={HOME_FRAME}>
        <div className={HOME_FRAME_CONTENT}>{children}</div>
        <HomeDock signedIn={signedIn} role={role ?? undefined} />
      </div>
    </HomeComposerProvider>
  );
}

/** The home's box, as a link names it (`ask-param.ts`). */
const HOME_ASK = { kind: 'home' } as const;

function HomeDock({ signedIn, role }: { signedIn: boolean; role?: UserRole }) {
  const { value, setValue, confidential, setConfidential, setRedacting, areaRef } = useHomeComposer();
  // A link's words (`/?ask=…`): the box is focused after them, and they stay
  // as the draft.
  useAskArrival(areaRef, HOME_ASK);
  return (
    <div data-home-dock="" className={HOME_COMPOSER_DOCK}>
      <div aria-hidden className={HOME_DOCK_FADE} />
      {/* ON A COMPUTER, THE SPACE'S SIZE (Stay, 24 October 2026: "for web the
          study and work chatbox is ridiculously massive. Use the one in the
          space area its smaller. and nicer"): centred and as wide as the
          Space's box (`SpaceChatDock`, `max-w-md`), with its text size. On a
          phone it fills the column, as before. */}
      <div ref={areaRef} className="md:mx-auto md:w-full md:max-w-md">
        <HomeComposer
          value={value}
          onValueChange={setValue}
          signedIn={signedIn}
          role={role}
          confidential={confidential}
          onConfidentialChange={setConfidential}
          className="p-2.5 shadow-lg"
          onRedactingChange={setRedacting}
          textareaClassName="text-base"
        />
      </div>
    </div>
  );
}
