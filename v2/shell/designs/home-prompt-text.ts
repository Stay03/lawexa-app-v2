/**
 * What a tapped home prompt puts in the box: the stub and one space, so the
 * next word typed starts a new word. Without it "Find a case on" plus
 * "tenancy" read "Find a case ontenancy" (Tester, 20 October 2026).
 */
export function promptText(label: string): string {
  return `${label} `;
}
