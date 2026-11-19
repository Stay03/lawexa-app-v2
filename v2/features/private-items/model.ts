import { formatFileSize } from '@/lib/utils/format-bytes';
import type { MySkillInput, TemplateStatus, UploadRefusal, UsedPrivateItem } from '@/types/private-items';
import { TEMPLATE_UPLOAD } from '@/types/private-items';

/**
 * The words the template and skill screens say (thread 9ae498ae). Pure, so
 * the tests read them without a browser.
 */

/** The status line under a template's name. */
export function templateStatusLine(status: TemplateStatus, error: string | null): string {
  if (status === 'processing') return 'Reading';
  if (status === 'live') return 'Ready';
  return error ? `Couldn’t read it: ${error}` : 'Couldn’t read it';
}

/** "report.docx · 48 KB · 6 blanks"; without a stored file, the blanks alone. */
export function templateDetail(file: { original_name: string; size: number } | null, blanks: number | null): string {
  const parts = file ? [file.original_name, formatFileSize(file.size)] : [];
  if (blanks !== null && blanks > 0) parts.push(`${blanks} ${blanks === 1 ? 'blank' : 'blanks'}`);
  return parts.join(' · ');
}

const REFUSAL: Record<UploadRefusal, string> = {
  type: 'only Word, RTF or PDF files can be templates',
  size: 'it is over 20 MB',
  duplicate: 'it is already one of your templates',
};

/** One line per refused file: "notes.txt wasn’t added: only Word, RTF or PDF files can be templates." */
export function refusalLine(name: string, reason: UploadRefusal): string {
  return `${name} wasn’t added: ${REFUSAL[reason]}.`;
}

/**
 * Checks the picker's files before upload, as the server would, so a refused
 * file is named at once: at most 10, Word, RTF or PDF, 20 MB each.
 */
export function splitUpload(files: readonly File[]): {
  accepted: File[];
  refused: { original_name: string; reason: UploadRefusal }[];
  overCount: boolean;
} {
  const extensions = TEMPLATE_UPLOAD.accept.split(',');
  const accepted: File[] = [];
  const refused: { original_name: string; reason: UploadRefusal }[] = [];
  for (const file of files) {
    const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
    if (!extensions.includes(extension)) refused.push({ original_name: file.name, reason: 'type' });
    else if (file.size > TEMPLATE_UPLOAD.maxBytes) refused.push({ original_name: file.name, reason: 'size' });
    else accepted.push(file);
  }
  const overCount = accepted.length > TEMPLATE_UPLOAD.maxFiles;
  return { accepted: accepted.slice(0, TEMPLATE_UPLOAD.maxFiles), refused, overCount };
}

export const SKILL_LIMITS = { display_name: 255, description: 300, instructions: 20_000 } as const;

/** What the skill form must say before it sends. Server sentences replace these when it answers. */
export function skillProblems(input: MySkillInput): Partial<Record<keyof MySkillInput, string>> {
  const problems: Partial<Record<keyof MySkillInput, string>> = {};
  const name = input.display_name.trim();
  const description = input.description.trim();
  const instructions = input.instructions.trim();
  if (!name) problems.display_name = 'Give the skill a name.';
  else if (name.length > SKILL_LIMITS.display_name) problems.display_name = 'Keep the name to 255 characters or fewer.';
  if (!description) problems.description = 'Say in one line what the skill is for.';
  else if (description.length > SKILL_LIMITS.description) problems.description = 'Keep this to 300 characters or fewer.';
  if (!instructions) problems.instructions = 'Write the steps Lawexa should follow.';
  else if (instructions.length > SKILL_LIMITS.instructions) problems.instructions = 'Keep the steps to 20,000 characters or fewer.';
  return problems;
}

/**
 * The quiet line where the owner's yes to an ask-first card sits in the chat.
 * The owner reads "You"; everyone else reads their name, never the item's.
 */
export function privateItemAnswerLine(
  answer: { choice: 'once' | 'always'; kind: 'template' | 'skill' },
  owner: { name: string; mine: boolean },
): string {
  const when = answer.choice === 'always' ? 'in this Space from now on' : 'just this time';
  return owner.mine
    ? `You let Lawexa use your ${answer.kind} ${when}`
    : `${owner.name} let Lawexa use one of their ${answer.kind}s ${when}`;
}

/**
 * The line under a Lawexa answer that used someone's own template or skill.
 * The owner sees the item's name; everyone else sees only whose it was.
 */
export function usedItemLine(item: UsedPrivateItem, viewerUuid: string | null): string {
  const what = item.kind === 'template' ? 'template' : 'skill';
  if (viewerUuid !== null && item.owner.uuid === viewerUuid) {
    return item.name ? `Used your ${item.name} ${what}` : `Used one of your ${what}s`;
  }
  return `Used a ${what} from ${item.owner.name}`;
}
