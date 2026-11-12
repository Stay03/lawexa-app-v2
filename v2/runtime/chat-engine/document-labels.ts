import type { MessageAttachment } from '@/types/chat';

/**
 * "Document 1, 2…": what a redacted chat calls the files sent in it (Arthur's
 * choice; backend 11fd72e0, 12 November 2026), so a file's own name, which
 * can carry a person's name, is never stored or shown. The server writes the
 * label; the app draws the same label on the question the moment it is sent,
 * and takes the server's when the send answers (`user_message_attachments`).
 *
 * The rule, the server's:
 * - Numbers run across the whole chat, in the order files were sent: if the
 *   first question sent two, the second question's first new file is
 *   Document 3.
 * - A file sent again keeps the label it got the first time.
 * - Every file on an earlier question counts, deleted or expired ones too.
 * - The label is exactly "Document N", with no extension.
 *
 * Pictures get no label: a redacted chat refuses them.
 */

const LABEL = /^Document (\d+)$/;

/** The label for the nth file of a redacted chat. */
export function documentLabel(n: number): string {
  return `Document ${n}`;
}

/** The labels already given in a chat's earlier questions: each file's label, and the highest number. */
export function labelsSoFar(earlier: readonly { role: string; attachments?: readonly MessageAttachment[] }[]): {
  byFile: Map<number, string>;
  highest: number;
} {
  const byFile = new Map<number, string>();
  let highest = 0;
  for (const message of earlier) {
    if (message.role !== 'user') continue;
    for (const file of message.attachments ?? []) {
      const match = LABEL.exec(file.file_name);
      if (!match) continue;
      if (!byFile.has(file.file_id)) byFile.set(file.file_id, file.file_name);
      highest = Math.max(highest, Number(match[1]));
    }
  }
  return { byFile, highest };
}

/**
 * The files of a new question in a redacted chat, as the chat will show them:
 * a file sent before keeps its label, a new one takes the next number.
 */
export function labelDocuments(
  earlier: readonly { role: string; attachments?: readonly MessageAttachment[] }[],
  files: readonly MessageAttachment[],
): MessageAttachment[] {
  const { byFile, highest } = labelsSoFar(earlier);
  let next = highest;
  const thisTurn = new Map<number, string>();
  return files.map((file) => {
    const known = byFile.get(file.file_id) ?? thisTurn.get(file.file_id);
    if (known) return { ...file, file_name: known };
    next += 1;
    const label = documentLabel(next);
    thisTurn.set(file.file_id, label);
    return { ...file, file_name: label };
  });
}

/**
 * The server's labels for the files of a sent question, laid over what the
 * app drew: its name for each file wins, and what the server does not send
 * back (the file's type) is kept. A file the server did not list keeps the
 * app's label.
 */
export function withServerLabels(
  drawn: readonly MessageAttachment[],
  server: readonly { file_id: number; file_name: string; file_size?: number }[] | undefined,
): MessageAttachment[] {
  if (!server || server.length === 0) return [...drawn];
  const named = new Map(server.map((file) => [file.file_id, file]));
  return drawn.map((file) => {
    const confirmed = named.get(file.file_id);
    return confirmed ? { ...file, file_name: confirmed.file_name, file_size: confirmed.file_size ?? file.file_size } : file;
  });
}
