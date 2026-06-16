import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function stripPastedTags(text: string): string {
  return text.replace(/<\/?pasted_content>/g, '').trim()
}

/**
 * Remove the inline content-context tags that get embedded in the first message
 * of a content-started chat — `<case_slug>`, `<note_slug>`, `<statute_slug>`,
 * and the radar id tags `<radar_uuid>` / `<radar_scan_uuid>`. The backend may
 * place these at the start or end of the message, so this matches them in any
 * position and trims leftover whitespace. Used so titles, previews, and message
 * bubbles show the human text rather than the machinery tag.
 */
export function stripContextTags(text: string): string {
  return text
    .replace(
      /<(case_slug|note_slug|statute_slug|radar_uuid|radar_scan_uuid)>[^<]*<\/\1>\s*/g,
      '',
    )
    .trim()
}

/**
 * Wrap each staged paste in a <pasted_content> tag and prepend them, in
 * order, to the typed text. With no pasted blocks this is just the trimmed
 * text, so callers can use it unconditionally.
 */
export function serializePastedContent(blocks: string[], text: string): string {
  const trimmed = text.trim()
  if (blocks.length === 0) return trimmed
  const wrapped = blocks
    .map((block) => `<pasted_content>${block}</pasted_content>`)
    .join('\n\n')
  return trimmed ? `${wrapped}\n\n${trimmed}` : wrapped
}

/**
 * Split a stored message into its pasted blocks (in order) and the remaining
 * typed text. Backward-compatible: a single block yields a one-element array,
 * and a message with none yields an empty array.
 */
export function parsePastedContent(content: string): {
  pastedTexts: string[]
  remainingText: string
} {
  const pastedTexts = [
    ...content.matchAll(/<pasted_content>([\s\S]*?)<\/pasted_content>/g),
  ].map((match) => match[1].trim())
  const remainingText = content
    .replace(/<pasted_content>[\s\S]*?<\/pasted_content>\s*/g, '')
    .trim()
  return { pastedTexts, remainingText }
}
