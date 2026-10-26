import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AxiosRequestConfig } from 'axios';
import { apiClient } from '@/lib/api/client';
import { radarReportFallbackName, spaceRadarsApi } from '@/lib/api/radars';
import { PERSONAL_RADAR_SCOPE, radarCalls, type RadarScope } from './scope';

/* Radar in Spaces (Stay's go, 26 October 2026): a Space Radar's screens are
 * the personal ones, sent to `/spaces/{space}/radars/...` instead (Backend's
 * contract). TEST DATA uuids throughout. */

const SPACE: RadarScope = { kind: 'space', spaceUuid: 'space-test-1' };

type Sent = { method: string; url: string; params?: unknown; data?: unknown; responseType?: string };

/** Every request the client sends while `run` runs, answered with `answer`. */
async function requests(
  run: () => Promise<unknown>,
  answer: (config: AxiosRequestConfig) => { data: unknown; headers?: Record<string, string> } = () => ({
    data: { success: true, data: {} },
  }),
): Promise<Sent[]> {
  const sent: Sent[] = [];
  const adapter = apiClient.defaults.adapter;
  apiClient.defaults.adapter = async (config) => {
    sent.push({
      method: String(config.method),
      url: String(config.url),
      ...(config.params ? { params: config.params } : {}),
      ...(config.data ? { data: JSON.parse(String(config.data)) } : {}),
      ...(config.responseType ? { responseType: config.responseType } : {}),
    });
    const { data, headers = {} } = answer(config);
    return { data, status: 200, statusText: 'OK', headers, config };
  };
  try {
    await run();
  } finally {
    apiClient.defaults.adapter = adapter;
  }
  return sent;
}

test('a Space Radar is read and run under its space; one report goes to /radars', async () => {
  const calls = radarCalls(SPACE);
  const sent = await requests(async () => {
    await calls.get('radar-1');
    await calls.getScans('radar-1', { unread: true });
    await calls.getScan('radar-1', 'scan-1');
    await calls.triageScan('radar-1', 'scan-1', { read: true });
    await calls.pause('radar-1');
    await calls.resume('radar-1');
    await calls.scanNow('radar-1');
    await calls.archive('radar-1');
    await calls.publishScan('radar-1', 'scan-1');
    await calls.unpublishScan('radar-1', 'scan-1');
  });
  assert.deepEqual(
    sent.map(({ method, url }) => `${method} ${url}`),
    [
      'get /spaces/space-test-1/radars/radar-1',
      'get /spaces/space-test-1/radars/radar-1/scans',
      // One report, its triage and its share: the personal routes, which
      // check the space's rules (Backend, 26 October 2026).
      'get /radars/radar-1/scans/scan-1',
      'patch /radars/radar-1/scans/scan-1',
      'post /spaces/space-test-1/radars/radar-1/pause',
      'post /spaces/space-test-1/radars/radar-1/resume',
      'post /spaces/space-test-1/radars/radar-1/scan',
      'delete /spaces/space-test-1/radars/radar-1',
      'post /radars/radar-1/scans/scan-1/publish',
      'post /radars/radar-1/scans/scan-1/unpublish',
    ],
  );
  assert.deepEqual(sent[1].params, { status: undefined, workflow_status: undefined, unread: 1, per_page: 15, page: 1 });
  assert.deepEqual(sent[3].data, { read: true });
});

test('a personal Radar keeps its own routes', async () => {
  const calls = radarCalls(PERSONAL_RADAR_SCOPE);
  const sent = await requests(async () => {
    await calls.get('radar-1');
    await calls.getScans('radar-1');
    await calls.triageScan('radar-1', 'scan-1', { read: true });
  });
  assert.deepEqual(
    sent.map(({ method, url }) => `${method} ${url}`),
    ['get /radars/radar-1', 'get /radars/radar-1/scans', 'patch /radars/radar-1/scans/scan-1'],
  );
});

test('a Space Radar is created in its space without channels', async () => {
  const sent = await requests(() =>
    spaceRadarsApi.create('space-test-1', { schedule_cron: '0 8 * * 1', topics: ['TEST DATA tenancy'], first_scan: true }),
  );
  assert.deepEqual(sent, [
    {
      method: 'post',
      url: '/spaces/space-test-1/radars',
      data: { schedule_cron: '0 8 * * 1', topics: ['TEST DATA tenancy'], first_scan: true },
    },
  ]);
});

test("a space's Radars list asks for archived ones only when told", async () => {
  const sent = await requests(async () => {
    await spaceRadarsApi.getList('space-test-1');
    await spaceRadarsApi.getList('space-test-1', { status: 'archived', page: 2 });
  });
  assert.deepEqual(sent[0].params, { status: undefined, per_page: 15, page: 1 });
  assert.deepEqual(sent[1].params, { status: 'archived', per_page: 15, page: 2 });
});

test('a report downloads as Word or PDF under the name the server gives', async () => {
  const sent = await requests(
    () => spaceRadarsApi.exportScan('radar-1', 'scan-1', 'pdf'),
    () => ({ data: 'TEST DATA', headers: { 'content-disposition': 'attachment; filename="TEST DATA report.pdf"' } }),
  );
  assert.deepEqual(sent, [
    { method: 'get', url: '/radars/radar-1/scans/scan-1/export', params: { format: 'pdf' }, responseType: 'blob' },
  ]);
  let file: { filename: string } | undefined;
  await requests(
    async () => {
      file = await spaceRadarsApi.exportScan('radar-1', 'scan-1', 'pdf');
    },
    () => ({ data: 'TEST DATA', headers: { 'content-disposition': 'attachment; filename="TEST DATA report.pdf"' } }),
  );
  assert.equal(file?.filename, 'TEST DATA report.pdf');
});

test('a report with no name from the server is lawexa-radar-report.docx or .pdf', async () => {
  assert.equal(radarReportFallbackName('docx'), 'lawexa-radar-report.docx');
  assert.equal(radarReportFallbackName('pdf'), 'lawexa-radar-report.pdf');
  let file: { filename: string } | undefined;
  await requests(
    async () => {
      file = await spaceRadarsApi.exportScan('radar-1', 'scan-1', 'docx');
    },
    () => ({ data: 'TEST DATA' }),
  );
  assert.equal(file?.filename, 'lawexa-radar-report.docx');
});
