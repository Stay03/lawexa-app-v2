/**
 * The admin pages' rules for AI skills (a1f45096, Stay approved the design at
 * 03:06Z on 28 October 2026; woz's server, Irish's screens): what a name may
 * be, the counters and token estimates, the words for each load mode, the
 * usage line, the restore question and the line diff between two versions.
 * Pure, so the node tests check them without a browser.
 */
import type { AdminAiSkillLoadMode, AdminAiSkillUsageTotals } from '@/types/admin-ai';

/** The server's limits (woz, 22:47Z). */
export const SKILL_NAME_MAX = 64;
export const SKILL_DESCRIPTION_MAX = 300;
export const SKILL_INSTRUCTIONS_MAX = 20_000;

/** snake_case: a lowercase letter first, then lowercase letters, digits and single underscores. */
const SKILL_NAME_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

/** Why a name is refused, or `null` when it is a good one. */
export function skillNameProblem(name: string): string | null {
  if (name.length === 0) return 'A name is required.';
  if (name.length > SKILL_NAME_MAX) return `At most ${SKILL_NAME_MAX} characters.`;
  if (!SKILL_NAME_PATTERN.test(name)) {
    return 'Lowercase letters, digits and single underscores, starting with a letter (e.g. research_legal_question).';
  }
  return null;
}

/** The name the form suggests from a display name, until the admin types one. */
export function suggestSkillName(displayName: string): string {
  return displayName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s_]/g, '')
    .trim()
    .replace(/[\s_]+/g, '_')
    .replace(/^[0-9_]+/, '')
    .slice(0, SKILL_NAME_MAX)
    .replace(/_+$/, '');
}

/** About how many tokens a text costs: characters / 4, as the server counts it. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** "1,240 / 20,000", for the counters under the long fields. */
export function counterLabel(length: number, max: number): string {
  return `${length.toLocaleString('en-US')} / ${max.toLocaleString('en-US')}`;
}

/** "~310 tokens". */
export function tokensLabel(tokens: number): string {
  return `~${tokens.toLocaleString('en-US')} tokens`;
}

export const LOAD_MODE_LABEL: Record<AdminAiSkillLoadMode, string> = {
  on_demand: 'On demand',
  always_on: 'Always on',
};

/** What each load mode does, said under the choice in the form. */
export function loadModeHint(mode: AdminAiSkillLoadMode, tokens: number): string {
  return mode === 'on_demand'
    ? 'Lawexa sees the description and opens the steps when the task needs them.'
    : `The steps go into every turn of each agent it is on: ${tokensLabel(tokens)} a turn.`;
}

/** The note beside an agent when the skill is always on. */
export function alwaysOnCostNote(tokens: number): string {
  return `Adds ${tokensLabel(tokens)} to every turn of this agent.`;
}

/**
 * The one line under the usage chart. On demand: how often it was opened when
 * it was offered (woz, 22:49Z: loaded = offered − offered_not_loaded). Always
 * on: how many turns it was given in full.
 */
export function usageLine(mode: AdminAiSkillLoadMode, totals: AdminAiSkillUsageTotals, days: number): string {
  const period = days === 1 ? 'the last day' : `the last ${days} days`;
  if (mode === 'always_on') {
    const turns = totals.loads_always_on;
    return `Given in full on ${turns.toLocaleString('en-US')} ${turns === 1 ? 'turn' : 'turns'} in ${period}.`;
  }
  if (totals.offered === 0) return `Not offered to Lawexa in ${period}.`;
  const loaded = Math.max(0, totals.offered - totals.offered_not_loaded);
  return `Loaded on ${loaded.toLocaleString('en-US')} of ${totals.offered.toLocaleString('en-US')} turns it was offered in ${period}.`;
}

/** The question before a restore: it adds a version, it never rewrites one. */
export function restoreQuestion(version: number, currentVersion: number): string {
  return `This saves version ${version} as a new version ${currentVersion + 1}. Nothing is lost: version ${currentVersion} stays in the history.`;
}

/** The toast after a save or a restore. */
export function savedAsVersion(version: number): string {
  return `Saved as version ${version}.`;
}

/** One line of a diff between two versions' instructions. */
export interface DiffLine {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

/**
 * A plain line diff (longest common subsequence) from `before` to `after`:
 * every line of each, in order, marked kept, removed or added. Instructions
 * are at most 20,000 characters, so the table stays small.
 */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const rows = a.length + 1;
  const cols = b.length + 1;
  const common: number[] = new Array(rows * cols).fill(0);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      common[i * cols + j] = a[i] === b[j] ? common[(i + 1) * cols + j + 1] + 1 : Math.max(common[(i + 1) * cols + j], common[i * cols + j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] });
      i += 1;
      j += 1;
    } else if (common[(i + 1) * cols + j] >= common[i * cols + j + 1]) {
      out.push({ kind: 'removed', text: a[i] });
      i += 1;
    } else {
      out.push({ kind: 'added', text: b[j] });
      j += 1;
    }
  }
  while (i < a.length) out.push({ kind: 'removed', text: a[i++] });
  while (j < b.length) out.push({ kind: 'added', text: b[j++] });
  return out;
}

/** "+3 −1", or "No changes to the steps". */
export function diffSummary(lines: readonly DiffLine[]): string {
  const added = lines.filter((line) => line.kind === 'added').length;
  const removed = lines.filter((line) => line.kind === 'removed').length;
  if (added === 0 && removed === 0) return 'No changes to the steps';
  return `+${added} −${removed}`;
}
