/**
 * What a share button hands the device's share sheet (`navigator.share`).
 *
 * A sentence and a link go as ONE text, the link on its own line, and with no
 * separate `url` field. Given both fields, a share target may join them into
 * one address: Arthur's results link arrived as
 * `.../quiz-results/{uuid}%20Arthur%20is%20the%20one%20to%20beat.` and his game
 * invite with the whole "Join my live quiz ..." sentence after the code, and
 * both pages then failed (live quiz test, Mac Chrome, 14 November 2026). In
 * one text there is nothing to join: every chat, mail and note app ends a link
 * at the line break, so the link stays whole and the sentence stays beside it.
 *
 * With no sentence there is nothing to glue on, so the link goes as the `url`
 * the sheet expects. The clipboard fallbacks copy the bare link either way.
 */
export function shareData({ title, text, url }: { title?: string | null; text?: string | null; url: string }): ShareData {
  const data: ShareData = {};
  if (title) data.title = title;
  const sentence = text?.trim();
  if (sentence) data.text = `${sentence}\n${url}`;
  else data.url = url;
  return data;
}
