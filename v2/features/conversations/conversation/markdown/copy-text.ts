/**
 * Copies text to the clipboard. Resolves `true` when it was copied, `false`
 * when the browser refused (insecure context, permission, no clipboard), so a
 * button confirms only a copy that happened. Never throws.
 */
export async function copyText(
  text: string,
  clipboard: Pick<Clipboard, 'writeText'> | undefined = typeof navigator === 'undefined' ? undefined : navigator.clipboard,
): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
