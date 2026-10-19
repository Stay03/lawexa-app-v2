import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* v2 Stage 1, item 8: a visitor who is not signed in opens Pricing and sees
 * the plans. GET /subscriptions/plans needs no token (backend 3da88635). */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const screen = read('v2', 'features', 'pricing', 'PricingScreen.tsx');

test('a visitor sees the plans as a guest does, never a sign-in wall on the plans tab', () => {
  assert.match(screen, /const planViewer = signedIn && role !== 'guest' \? 'account' : 'guest';/);
  assert.match(screen, /\{tab === 'plans' \? <Plans viewer=\{planViewer\} offersDaily=\{role === 'superadmin'\} \/> : null\}/);
  assert.doesNotMatch(screen, /Sign in to see plans/);
});

test('a visitor’s plan button opens registration, never checkout, and sign-in is offered once', () => {
  const card = read('v2', 'features', 'pricing', 'PlanCard.tsx');
  assert.match(card, /if \(viewer === 'guest'\) \{\s*return \(\s*<Button asChild variant=\{variant\} className=\{size\}>\s*<Link href=\{REGISTER_HREF\}>Create an account<\/Link>/);
  assert.match(screen, /\{!isAccount \? \(\s*<p[^>]*>\s*Already have an account\?\{' '\}\s*<Link href=\{SIGN_IN_HREF\}/);
  // The account's own reads stay off for a visitor.
  assert.match(screen, /const current = useQuery\(\{ \.\.\.billingQueries\.current\(\), enabled: isAccount \}\);/);
  assert.match(screen, /const asksTrial = isAccount && plans\.isSuccess && currency === 'NGN';/);
});

test('message packs are still bought and priced on an account', () => {
  assert.match(screen, /title="Sign in to buy message packs"/);
});
