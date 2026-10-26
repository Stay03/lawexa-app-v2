import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The account menu at the foot of the sidebar and the bar's ⋮ (Stay, 26
 * October 2026: "remove … the drop down menu at the top and also that profile
 * area at the bottom should show the options like in v1 but few since settings
 * have everything, keep the upgrade button there too"; the list approved at
 * 03:51 UTC). */
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const footer = read('v2', 'shell', 'V2UserFooter.tsx');
const menu = read('v2', 'shell', 'V2HeaderMenu.tsx');
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the account row opens a menu: Profile, Settings, Pricing, Theme, Admin for an admin, the legal pages, Sign out', () => {
  assert.match(footer, /<DropdownMenuTrigger asChild>\s*<button\s+type="button"/);
  const rows = [...footer.matchAll(/<span(?: className="flex-1")?>([A-Z][A-Za-z ]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(rows, ['Profile', 'Settings', 'Pricing', 'Theme', 'Admin', 'Privacy policy', 'Terms of service', 'Sign out']);
  // Pricing for every account, free or paid (Stay, 26 October 2026, 08:36 UTC).
  assert.doesNotMatch(footer, /\{showUpgrade \? \(\s*<DropdownMenuItem/);
  for (const href of ['/settings/profile', '/settings', '/pricing', '/privacy', '/terms']) {
    assert.match(footer, new RegExp(`<Link href="${href}" onClick=\\{\\(\\) => onNavigate\\?\\.\\('${href}'\\)\\}>`), href);
  }
  // Admin only for an admin, and loaded, since the admin pages are in the classic app.
  assert.match(footer, /const isAdmin = user\.role === 'admin' \|\| user\.role === 'superadmin';/);
  assert.match(footer, /\{isAdmin \? \(\s*<DropdownMenuItem asChild className="min-h-11 md:min-h-8">\s*\{\/\*[\s\S]*?\*\/\}\s*<a href="\/admin">/);
  // Sign out asks first, with the same question as the settings screen.
  assert.match(footer, /onSelect=\{\(\) => setSignOutOpen\(true\)\}/);
  assert.match(footer, /<SignOutConfirm open=\{signOutOpen\} onOpenChange=\{setSignOutOpen\} \/>/);
  assert.match(read('v2', 'features', 'settings', 'sign-out', 'SignOutRow.tsx'), /<SignOutConfirm open=\{open\} onOpenChange=\{setOpen\} \/>/);
});

test('a free account sees Upgrade beside the row, only once its plan has loaded', () => {
  assert.match(footer, /const showUpgrade = planQuery\.isSuccess && planQuery\.data\?\.data\?\.is_free_tier !== false;/);
  assert.match(footer, /\{showUpgrade \? \(\s*<Button[\s\S]*?<Link href="\/pricing" onClick=\{\(\) => onNavigate\?\.\('\/pricing'\)\}>\s*Upgrade\s*<\/Link>/);
  // With the pill there, the row drops "· Free", so the handle is not cut.
  assert.match(footer, /\{showUpgrade \? null : \(\s*<>\s*<span aria-hidden className="shrink-0">/);
});

test('a guest keeps a way to Settings', () => {
  assert.match(footer, /<Link\s+href="\/settings"\s+onClick=\{\(\) => onNavigate\?\.\('\/settings'\)\}/);
});

test("the bar's ⋮ holds only the screen's own rows and is gone without them", () => {
  assert.match(menu, /if \(screenActions\.length === 0\) return null;/);
  assert.doesNotMatch(code(menu), /href="\/settings"|Theme|setTheme|Switch to classic/);
});
