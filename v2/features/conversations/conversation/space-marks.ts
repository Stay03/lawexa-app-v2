import type { MessageGroup } from './message-groups';
import { isNewDay } from './day-label';

/**
 * What a space chat draws between and above its groups (Arthur's layout, 14
 * October 2026), worked out once from the groups. Pure, so it is tested as it
 * is.
 *
 *  - `day`: a date separator before this group, when it is the first group or
 *    the first of a new local day.
 *  - `answer`: Lawexa's mark above this group, when an answer starts here: the
 *    first group that is not a question after a question (or at the top). An
 *    answer of several groups (steps, then text) is marked once.
 */
export interface GroupMarks {
  day: Date | null;
  answer: Date | null;
}

const isQuestion = (group: MessageGroup) => group.type === 'single' && group.message.role === 'user';

/** A group's time: its first message's. Null when the time cannot be read. */
export function groupTime(group: MessageGroup): Date | null {
  const first =
    group.type === 'single' ? group.message : group.type === 'tool-chain' ? group.messages[0] : group.handover;
  const at = first?.timestamp;
  return at instanceof Date && !Number.isNaN(at.getTime()) ? at : null;
}

export function spaceMarks(groups: readonly MessageGroup[]): GroupMarks[] {
  let lastTime: Date | null = null;
  return groups.map((group, index) => {
    const at = groupTime(group);
    const day = at !== null && isNewDay(lastTime, at) ? at : null;
    if (at !== null) lastTime = at;
    const answer = !isQuestion(group) && (index === 0 || isQuestion(groups[index - 1])) ? at : null;
    return { day, answer };
  });
}
