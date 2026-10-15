'use client';

import { useHeaderContext } from '@/v2/shell/header-context';

/**
 * ConversationMasthead — a chat's heading, for screen readers only.
 *
 * A chat wears the list pages' open bar (Stay, 13 October 2026), so its title
 * moved out of the bar into the top of the transcript, with the space it is in
 * as a link under it. Stay then asked for both to go (15 October 2026: "I dont
 * like the chat title and space name at the top of chat and space
 * conversation. remove them it also make the loading looks jumpy when loading
 * for the first time. I see the title when the skeleton is showing just remove
 * it from both the skeleton and the final page load"). Nothing is drawn now:
 * no title, no space link, and no title-shaped shimmer while it resolves, so
 * the first frame and the loaded page start at the same first message.
 *
 * The page keeps its heading for assistive technology: an `sr-only` h1 with
 * the title the controller publishes. It is absolutely placed (`sr-only`), so
 * it takes no row in the transcript's column and adds no gap above it.
 */
export function ConversationMasthead() {
  const { title, confidential } = useHeaderContext();
  if (title === null) return null;
  return (
    <h1 className="sr-only">
      {title}
      {confidential ? ', confidential' : null}
    </h1>
  );
}
