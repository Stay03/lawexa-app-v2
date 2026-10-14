/**
 * `/c/{id}?m={messageId}`: the message to go to once the chat opens (a mention
 * or reply notification's `action_url`, techlead's contract of 14 October
 * 2026). A positive whole number, or nothing: anything else is ignored and the
 * chat opens at the bottom as usual.
 */
export function jumpTarget(m: string | string[] | undefined): number | null {
  const raw = Array.isArray(m) ? m[0] : m;
  if (raw === undefined || !/^[1-9]\d{0,15}$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}
