import type { IPlan, IPlanLimit, TUploadLimitType } from '@/types/subscription';

/**
 * A pricing card's file lines, read off the plan's own `limits[]` rows (Stay's
 * B, threads 1c93152c and 4a2029c5, 31 October 2026), so the size an admin sets
 * is the size the card prints. v1's table had "Chat with Document (10MB limit)"
 * typed in, and it went stale the day the plans changed.
 *
 * The server resolves a capped limit the same way (`FileLimitService`): a
 * document's size and the files per message stop at a ceiling, and -1 means
 * the ceiling. Storage has no ceiling, so -1 there is unlimited.
 */
const CEILINGS: Partial<Record<TUploadLimitType, number>> = {
  // 500 MB since uploads go straight to storage (Backend 527ce6a4).
  upload_size_mb: 500,
  files_per_message: 20,
};

/** v1's line for documents; the card swaps it for the plan's own. */
export const DOCUMENT_LINE_PREFIX = 'Chat with Document';

function row(plan: Pick<IPlan, 'limits'>, type: TUploadLimitType): IPlanLimit | undefined {
  return plan.limits.find((limit) => limit.type === type);
}

/** The number the server applies, or null for unlimited storage. */
function resolved(limit: IPlanLimit): number | null {
  const ceiling = CEILINGS[limit.type as TUploadLimitType] ?? null;
  const open = limit.is_unlimited || limit.value < 0;
  if (open) return ceiling;
  return ceiling === null ? limit.value : Math.min(limit.value, ceiling);
}

/** 2048 → "2GB", 1536 → "1.5GB", 500 → "500MB". */
export function storageSize(mb: number): string {
  if (mb < 1024) return `${mb}MB`;
  return `${Number((mb / 1024).toFixed(1))}GB`;
}

/**
 * "Chat with Document (25MB limit)", "Up to 5 Files per Message" and
 * "2GB File Storage", in that order, in the words of the lines around them.
 * A row the plan does not send gives no line, and a document line with no
 * size row keeps no number rather than an old one.
 */
export function fileLines(plan: Pick<IPlan, 'limits'>): string[] {
  const lines: string[] = [];
  const size = row(plan, 'upload_size_mb');
  const sizeMb = size ? resolved(size) : null;
  lines.push(sizeMb !== null && sizeMb > 0 ? `${DOCUMENT_LINE_PREFIX} (${sizeMb}MB limit)` : DOCUMENT_LINE_PREFIX);

  const files = row(plan, 'files_per_message');
  const count = files ? resolved(files) : null;
  if (count !== null && count > 0) lines.push(count === 1 ? 'One File per Message' : `Up to ${count} Files per Message`);

  const storage = row(plan, 'storage_mb');
  if (storage) {
    const mb = resolved(storage);
    if (mb === null) lines.push('Unlimited File Storage');
    else if (mb > 0) lines.push(`${storageSize(mb)} File Storage`);
  }
  return lines;
}

/**
 * A tier's lines with v1's document line swapped for the plan's file lines,
 * in the same place. A list without that line gets them at the end.
 */
export function withFileLines(lines: readonly string[], plan: Pick<IPlan, 'limits'>): string[] {
  const files = fileLines(plan);
  const at = lines.findIndex((line) => line.startsWith(DOCUMENT_LINE_PREFIX));
  if (at === -1) return [...lines, ...files];
  return [...lines.slice(0, at), ...files, ...lines.slice(at + 1)];
}
