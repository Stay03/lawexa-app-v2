import type { StatuteDetail } from '@/types/statute';

/**
 * The kind of law in a statute's header line: "Rules", "Regulations",
 * "Order" (Arthur, 21 October 2026: label each statute by its kind). The
 * server reads it from the title as `kind`. `document_type` is the same
 * ("act") for every statute, so it stands in only for a server without
 * `kind`: 'act' → 'Act'.
 */
export function statuteKindLabel(
  detail: Pick<StatuteDetail, 'kind' | 'document_type'>,
): string | null {
  const kind = detail.kind?.trim();
  if (kind) return kind;
  const type = detail.document_type?.trim();
  if (!type) return null;
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
}
