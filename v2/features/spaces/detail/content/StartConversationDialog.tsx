'use client';

import { useState } from 'react';

import { useV2Session } from '@/v2/runtime/session-context';
import { HomeComposer, type HomeComposerSpace } from '@/v2/shell/designs/HomeComposer';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { startDialogLine } from '../../content-model';

/**
 * StartConversationDialog — "New conversation" from a space's Conversations
 * tab (Spaces F4, backend B4; the techlead's T1: an overlay holding the home
 * composer). A sheet on a phone, the centred card on a desktop.
 *
 * ONE CREATE PATH. The composer inside is the home's own, given the space
 * (`HomeComposer`'s `space`), so a chat started here runs the same
 * `startConversation` flow as one started at home: the handoff, the upload
 * rules, the jurisdiction, the workflow, and the move to `/c/{id}` with the
 * stream attached. The overlay leaves with the route. What the space changes:
 * the request carries `space_uuid`, the plus-menu offers no private modes
 * (the server refuses both in a space), no Study mode is sent (T3: nothing in
 * a space happens by itself), and a refusal is said in the space's words.
 *
 * Typing is not thrown away by a stray tap beside the sheet (`guardUnsaved`);
 * Escape and the close control still close it.
 */
export function StartConversationDialog({
  space,
  open,
  onOpenChange,
}: {
  space: HomeComposerSpace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const session = useV2Session();
  const [value, setValue] = useState('');

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="New conversation"
      description={startDialogLine(space.name)}
      size="content"
      guardUnsaved={value.trim().length > 0}
    >
      <div className="pb-2">
        <HomeComposer
          value={value}
          onValueChange={setValue}
          signedIn={session.signedIn}
          role={session.role ?? undefined}
          space={space}
          className="p-2.5"
          textareaClassName="text-base"
        />
      </div>
    </ResponsiveOverlay>
  );
}
