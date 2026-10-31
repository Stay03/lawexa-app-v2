import type { CaseArgumentAuthority } from '@/types/case';

/**
 * What an argument's authority shows, and its key in the list.
 *
 * The public payload carries no reporter key (Stay's A, thread b74f2724): the
 * server drops `nwlr_key` and fills `display_title` from the citation's own
 * words. So the title is the only label, and a row without one shows nothing.
 */
export function authorityLabel(authority: Pick<CaseArgumentAuthority, 'display_title'>): string | null {
  const title = authority.display_title?.trim();
  return title ? title : null;
}

/** The same case can stand behind two rows, so the place in the list keeps keys apart. */
export function authorityKey(authority: Pick<CaseArgumentAuthority, 'cited_case_id'>, index: number): string {
  return `${authority.cited_case_id ?? 'unlinked'}-${index}`;
}
