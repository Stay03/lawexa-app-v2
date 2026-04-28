import type { JurisdictionChoice } from '@/types/jurisdiction';

// Single source of truth for the three-state wire encoding.
// 'auto'     → field absent (backend resolves from profile/IP)
// 'override' → field is the slug
// 'none'     → field is explicit JSON null
export function applyJurisdiction<T extends object>(
  body: T,
  choice: JurisdictionChoice,
): T & { jurisdiction?: string | null } {
  if (choice.mode === 'override') return { ...body, jurisdiction: choice.slug };
  if (choice.mode === 'none') return { ...body, jurisdiction: null };
  return body;
}
