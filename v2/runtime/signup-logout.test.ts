import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Stay, 19 October 2026, 15:09 UTC: "Add the logout so users can logout and
 * test". The screens before the app had no way out but finishing. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('Log out is the app’s own log out, drawn only for a signed-in account', () => {
  const button = read('components', 'auth', 'LogOutButton.tsx');
  assert.match(button, /const \{ isAuthenticated, isGuest, logout, isLoggingOut \} = useAuth\(\);/);
  assert.match(button, /if \(!isAuthenticated \|\| isGuest\) return null;/);
  assert.match(button, /onClick=\{\(\) => logout\(\)\}/);
  assert.match(button, /disabled=\{isLoggingOut\}/);
  // useAuth's logout ends on the sign-in page.
  assert.match(read('lib', 'hooks', 'useAuth.ts'), /clearAuth\(\);\s*queryClient\.clear\(\);\s*router\.push\('\/login'\);/);
});

test('every onboarding step, "Check your email" and the link’s landing page carry it', () => {
  const layout = read('app', '(onboarding)', 'layout.tsx');
  assert.match(layout, /<div className="absolute right-3 top-3 z-10">\s*<LogOutButton \/>\s*<\/div>\s*<main>\{children\}<\/main>/);
  const checkEmail = read('app', '(auth)', 'check-email', 'page.tsx');
  assert.match(checkEmail, /Sign up again\s*<\/a>\s*<\/p>\s*<LogOutButton \/>\s*<\/CardFooter>/);
  const verified = read('app', '(auth)', 'email-verified', 'page.tsx');
  assert.match(verified, /<\/Button>\s*<\/div>\s*<LogOutButton \/>\s*<\/CardFooter>/);
});
