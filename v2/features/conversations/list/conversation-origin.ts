import type { ConversationReference } from '@/types/chat';

/**
 * What a chat was started from, for its row's second line: the case, statute
 * or note it was opened on. Two chats with the same name could not be told
 * apart in the list (Tester, 20 October 2026, finding 4); the thing each was
 * about tells them apart. `null` when the chat was not started from one, or
 * the item was deleted (`content: null`), or the list sent no references.
 */
export function conversationOrigin(references: readonly ConversationReference[] | null | undefined): string | null {
  for (const reference of references ?? []) {
    const name = originName(reference);
    if (name) return name;
  }
  return null;
}

function originName(reference: ConversationReference): string | null {
  switch (reference.type) {
    case 'case':
      return clean(reference.content?.display_title) ?? clean(reference.content?.title);
    case 'statute':
      return clean(reference.content?.short_title) ?? clean(reference.content?.title);
    case 'note':
      return clean(reference.content?.title);
    default:
      // A radar chat is named after its radar already.
      return null;
  }
}

function clean(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text ? text : null;
}

/**
 * The full date and time for a row's time, shown on hover ("21 Oct 2026,
 * 14:05"). In one fixed zone, Lagos, where Lawexa's readers are, so the server
 * render and the browser print the same text and the page hydrates cleanly.
 */
export function fullTime(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
  });
}
