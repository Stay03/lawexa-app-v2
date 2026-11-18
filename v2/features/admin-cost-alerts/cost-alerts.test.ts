import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  COST_ALERT_NOTE,
  costAlertFiltersFrom,
  costAlertParams,
  costAlertRule,
  costAlertSearch,
  formatShare,
  formatUsd,
  periodLabel,
  shareTone,
  userCostAlertLine,
} from '@/lib/utils/cost-alerts';

/* Admin cost alerts (Arthur, 18 November 2026, thread dfa0d9b8; Backend's
 * contract). The admin pages live outside v2, so the rules are pinned here,
 * where the suite runs. TEST DATA. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const search = (value: string) => new URLSearchParams(value);

test('the filters read from the address, with the defaults for anything unknown', () => {
  assert.deepEqual(costAlertFiltersFrom(search('')), { period: 'current', sort: 'percent', user: null, page: 1 });
  assert.deepEqual(costAlertFiltersFrom(search('period=all&sort=cost&user=u-1&page=3')), { period: 'all', sort: 'cost', user: 'u-1', page: 3 });
  assert.deepEqual(costAlertFiltersFrom(search('period=yesterday&sort=name&page=-2')), { period: 'current', sort: 'percent', user: null, page: 1 });
});

test('the address leaves the defaults out, and the request sends what the server takes', () => {
  assert.equal(costAlertSearch({ period: 'current', sort: 'percent', user: null, page: 1 }), '');
  assert.equal(costAlertSearch({ period: 'past', sort: 'percent', user: 'u-1', page: 2 }), 'period=past&user=u-1&page=2');
  assert.deepEqual(costAlertParams({ period: 'current', sort: 'cost', user: null, page: 1 }), { period: 'current', sort: 'cost', page: 1, per_page: 25 });
  assert.deepEqual(costAlertParams({ period: 'all', sort: 'percent', user: 'u-1', page: 2 }), { period: 'all', sort: 'percent', page: 2, per_page: 25, user: 'u-1' });
});

test('costs, shares and periods are said plainly', () => {
  assert.equal(formatUsd(31.2), '$31.20');
  assert.equal(formatUsd(0.0234), '$0.023', 'cents keep three places');
  assert.equal(formatUsd(0), '$0.00');
  assert.equal(formatShare(105.3), '105%');
  assert.equal(formatShare(8.46), '8.5%');
  assert.equal(shareTone(199, 100), 'over');
  assert.equal(shareTone(200, 100), 'severe');
  assert.equal(periodLabel('2026-11-02T10:00:00Z', '2026-12-02T10:00:00Z'), '2 Nov – 2 Dec 2026');
  assert.equal(periodLabel('2026-11-02T10:00:00Z', null), '2 Nov 2026 onwards');
});

test('the screen states the rule from the list’s own settings, and the estimate note', () => {
  assert.equal(
    costAlertRule({ threshold_percent: 100, usd_to_ngn_rate: 1350, includes_web_search: true }),
    'Flags a paying user whose AI and web search cost in a paid period reaches 100% of their plan price. Naira prices at ₦1,350 to the dollar. Checked daily at 06:00 UTC.',
  );
  assert.match(costAlertRule({ threshold_percent: 80, usd_to_ngn_rate: 1350, includes_web_search: false }), /whose AI cost in a paid period reaches 80%/);
  assert.equal(COST_ALERT_NOTE, 'Costs are estimates at admin model prices; file reading (OCR) is not counted yet.');
  assert.equal(
    userCostAlertLine({ percent: 105.3, cost_usd: 31.2, price_usd: 29.63 }),
    'AI cost 105% of plan price this period ($31.20 of $29.63)',
  );
});

test('the wiring: the list route, the nav, the settings card, the user badge and line', () => {
  assert.match(read('lib', 'api', 'admin-cost-alerts.ts'), /apiClient\.get<CostAlertsResponse>\('\/admin\/cost-alerts', \{ params \}\)/);
  assert.match(read('components', 'admin', 'admin-nav-billing.tsx'), /\{ title: 'Cost alerts', url: '\/admin\/cost-alerts', icon: TriangleAlert, exact: true \}/);
  const groups = read('types', 'admin-settings.ts');
  assert.match(groups, /'pricing',\n[\s\S]{0,200}'billing',\n\];/, 'the billing group is drawn on the billing settings screen');
  const settings = read('components', 'admin', 'billing', 'BillingSettingsContent.tsx');
  assert.match(settings, /billing: 'Cost alerts',/);
  assert.match(settings, /const costAlertQuery = useAdminSettings\(\{ group: 'billing' \}\);/);
  assert.doesNotMatch(settings, /isError = [^;]*costAlertQuery/, 'an older server without the group does not take the page down');
  assert.match(read('components', 'admin', 'AdminUsersTable.tsx'), /\{user\.cost_alert && \(/);
  assert.match(read('app', '(admin)', 'admin', 'users', '[uuid]', 'page.tsx'), /href=\{`\/admin\/cost-alerts\?user=\$\{encodeURIComponent\(user\.uuid\)\}`\}/);
  const page = read('app', '(admin)', 'admin', 'cost-alerts', 'page.tsx');
  assert.match(page, /\{COST_ALERT_NOTE\}/);
  // The API trait puts page numbers in `pagination`; the controller's `meta` holds only the rule (2b0825e0).
  assert.match(page, /const pages = alerts\.data\?\.pagination;/);
  assert.doesNotMatch(page, /meta\.(current_page|last_page|total)/);
  // A deleted user or plan comes back null and must not break the row.
  const table = read('components', 'admin', 'cost-alerts', 'CostAlertsTable.tsx');
  assert.match(table, /\{alert\.user \? \(/);
  assert.match(table, /\{alert\.plan \? \(/);
});
