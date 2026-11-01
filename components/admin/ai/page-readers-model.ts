import type { AdminPageReaderOption, AdminPageReaders, AdminPageReadersUpdate } from '@/types/admin-ai';

/**
 * The admin "Page readers" choice (Stay, 1c93152c 04:26Z 1 November 2026:
 * Claude Haiku 5.5 reads the pages, settable in the admin pages; Backend's
 * contract in 384c, 649ad95c). Two choices from the models that read
 * pictures: the one that reads every scanned page, and an optional backup
 * for a page the first fails on. The admin picks by name and the app saves
 * the server's own `reader` string; it never builds the provider suffix.
 * No React, so node:test reads it.
 */

/** The backup select's "none" value: a Select item cannot carry an empty string. */
export const NO_BACKUP = 'none';

/**
 * The choices to list. A reader saved before this screen (on the raw
 * Settings field) that is not among the picture models still shows, under
 * its saved string, so the current choice is never blank.
 */
export function readerChoices(data: AdminPageReaders): AdminPageReaderOption[] {
  const choices = [...data.options];
  for (const saved of [data.first, data.backup]) {
    if (saved && !choices.some((option) => option.reader === saved)) {
      choices.push({ model_id: 0, name: saved, reader: saved });
    }
  }
  return choices;
}

/** The name a reader is listed under, or the saved string itself. */
export function readerName(choices: readonly AdminPageReaderOption[], reader: string): string {
  return choices.find((option) => option.reader === reader)?.name ?? reader;
}

/** What the form starts from: the saved choice, with no first reader as '' and no backup as `NO_BACKUP`. */
export function pageReadersStart(data: AdminPageReaders): { first: string; backup: string } {
  return { first: data.first ?? '', backup: data.backup ?? NO_BACKUP };
}

/** What stops the save before it is sent: the server refuses a backup equal to the first. */
export function pageReadersError(first: string | null, backup: string): string | null {
  if (!first) return 'Choose the model that reads scanned pages first.';
  if (backup !== NO_BACKUP && backup === first) return 'The backup must be a different model from the first.';
  return null;
}

export function pageReadersPayload(first: string, backup: string): AdminPageReadersUpdate {
  return { first, backup: backup === NO_BACKUP ? null : backup };
}

/** The save's confirmation, in the names the admin chose by. */
export function pageReadersSaved(choices: readonly AdminPageReaderOption[], saved: AdminPageReadersUpdate): string {
  const first = readerName(choices, saved.first);
  return saved.backup
    ? `Scanned pages are now read by ${first}, with ${readerName(choices, saved.backup)} as the backup.`
    : `Scanned pages are now read by ${first}, with no backup.`;
}
