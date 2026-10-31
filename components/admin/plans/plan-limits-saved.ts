import type { IPlanLimit } from '@/types/subscription';
import { DOCUMENT_LINE_PREFIX, fileLines } from '@/lib/utils/plan-file-lines';

/**
 * What the admin sees after saving a plan's limits (Stay's B, thread 4a2029c5,
 * 31 October 2026: "in the admin show that the values show in pricing page
 * maybe in the save confirmation"). A paid plan's confirmation names the lines
 * its pricing card now prints, read off the saved plan the server sends back.
 * The free plan has no card, so its confirmation says only that it saved.
 */
export interface LimitsSavedToast {
  title: string;
  description?: string;
}

export function limitsSavedToast(isFree: boolean, data: unknown): LimitsSavedToast {
  const title = 'Plan limits saved.';
  if (isFree) return { title };
  const limits = savedLimits(data);
  const lines = limits ? fileLines({ limits }).filter((line) => line !== DOCUMENT_LINE_PREFIX) : [];
  if (lines.length === 0) return { title, description: 'The pricing page shows the new values.' };
  return { title, description: `The pricing page now shows: ${lines.join(', ')}.` };
}

/** The saved plan's limit rows: the server answers with the plan, or with its rows. */
function savedLimits(data: unknown): IPlanLimit[] | null {
  if (Array.isArray(data)) return data as IPlanLimit[];
  if (data && typeof data === 'object' && Array.isArray((data as { limits?: unknown }).limits)) {
    return (data as { limits: IPlanLimit[] }).limits;
  }
  return null;
}
