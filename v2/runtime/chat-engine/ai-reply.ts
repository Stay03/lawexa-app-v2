/**
 * Whether Lawexa answers the message just sent (Backend space-chat-tag-only,
 * 7932d22b; Stay, 15 November 2026, thread 39c968a5). In a Space where Lawexa
 * answers only when tagged, a message that does not tag it is saved and
 * nothing is streamed: the send answers `ai_reply: false`.
 *
 * Absent means yes. The app ships before the server that sends the field, and
 * a server without it answers every message, so only an explicit `false` ends
 * the turn at the send.
 */
export function expectsAiReply(data: { ai_reply?: boolean }): boolean {
  return data.ai_reply !== false;
}
