import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Notification } from '@/types/notification';
import {
  notificationChannelUuid,
  notificationMessageUuid,
  presentNotification,
} from './presentation';

const ORIGIN = 'https://lawexa.com';

/** A row with every field the list returns, overridable per case. Ids and
 *  names are redacted stand-ins for the live shapes measured on 2026-10-05. */
function row(overrides: Partial<Notification>): Notification {
  return {
    id: 'n-1',
    type: 'ChannelMentionNotification',
    title: '',
    message: null,
    action_url: null,
    icon: null,
    read_at: null,
    created_at: '2026-10-04T23:39:16+00:00',
    ...overrides,
  };
}

test('a mention reads its own words and opens the message in the channel', () => {
  const mention = row({
    title: 'Ada mentioned you in #contract-law',
    message: 'Can you look at the indemnity clause before the call...',
    action_url: '/channels/c-1?m=m-1',
    icon: 'mention',
    channel_uuid: 'c-1',
    message_uuid: 'm-1',
  });
  assert.deepEqual(presentNotification(mention, ORIGIN), {
    mark: 'mention',
    title: 'Ada mentioned you in #contract-law',
    preview: 'Can you look at the indemnity clause before the call...',
    destination: { kind: 'internal', href: '/channels/c-1?m=m-1' },
  });
});

test('a live quiz opens the lobby on the channel, not the backend path', () => {
  const quiz = row({
    type: 'ChannelQuizLiveNotification',
    title: 'Ada started a quiz in #Product Development',
    message: '“Nigerian Legal System — Easy Basics” — 5 questions. The lobby is open.',
    action_url: '/channels/c-2/quiz-games/g-9',
    icon: 'quiz',
    channel_uuid: 'c-2',
  });
  const presented = presentNotification(quiz, ORIGIN);
  assert.equal(presented.mark, 'quiz');
  assert.deepEqual(presented.destination, { kind: 'internal', href: '/channels/c-2?game=g-9' });
});

test('a channel invitation opens the one invitations screen', () => {
  const invite = row({
    type: 'ChannelInviteNotification',
    title: 'Invitation to #Product Development',
    message: 'Ada invited you to join #Product Development in Lawexa HQ.',
    action_url: '/channel-invitations',
    icon: 'invite',
  });
  const presented = presentNotification(invite, ORIGIN);
  assert.equal(presented.mark, 'invite');
  assert.deepEqual(presented.destination, { kind: 'internal', href: '/invitations' });
});

test('a space invitation and an organization invitation open it too', () => {
  for (const path of ['/space-invitations', '/organization-invitations', '/space-invitations/']) {
    const presented = presentNotification(
      row({ type: 'SpaceInviteNotification', action_url: path, icon: 'invite' }),
      ORIGIN,
    );
    assert.deepEqual(presented.destination, { kind: 'internal', href: '/invitations' }, path);
  }
});

test('a new row that already says /invitations is left as it is', () => {
  const presented = presentNotification(row({ action_url: '/invitations' }), ORIGIN);
  assert.deepEqual(presented.destination, { kind: 'internal', href: '/invitations' });
});

test('a wordless row is labelled with its kind and gets no preview', () => {
  const presented = presentNotification(row({ action_url: '/channels/c-1?m=m-1' }), ORIGIN);
  assert.equal(presented.title, 'You were mentioned');
  assert.equal(presented.preview, null);
  assert.equal(presented.mark, 'mention');
});

test('an unknown kind is humanised rather than dropped', () => {
  const presented = presentNotification(row({ type: 'WeeklyDigestNotification' }), ORIGIN);
  assert.equal(presented.title, 'Weekly digest');
  assert.equal(presented.mark, 'general');
});

test('a protocol-relative or non-http link goes nowhere', () => {
  for (const link of ['//evil.example/x', 'javascript:alert(1)', 'mailto:a@b.c', '   ']) {
    assert.deepEqual(
      presentNotification(row({ action_url: link }), ORIGIN).destination,
      { kind: 'none' },
      link,
    );
  }
});

test('a link to another site stays external, untouched', () => {
  const href = 'https://example.org/report?id=4#top';
  assert.deepEqual(presentNotification(row({ action_url: href }), ORIGIN).destination, {
    kind: 'external',
    href,
  });
});

test('a full link on this site opens in the app, with its query and anchor', () => {
  const presented = presentNotification(
    row({ type: 'AdminMessageNotification', action_url: 'https://lawexa.com/cases/abc?tab=report#h2' }),
    ORIGIN,
  );
  assert.deepEqual(presented.destination, { kind: 'internal', href: '/cases/abc?tab=report#h2' });
});

test('a full link on this site to a legacy inbox is rewritten too', () => {
  const presented = presentNotification(
    row({ action_url: 'https://lawexa.com/space-invitations' }),
    ORIGIN,
  );
  assert.deepEqual(presented.destination, { kind: 'internal', href: '/invitations' });
});

test('without a known origin every absolute link stays external', () => {
  const href = 'https://lawexa.com/cases/abc';
  assert.deepEqual(presentNotification(row({ action_url: href }), null).destination, {
    kind: 'external',
    href,
  });
});

test('a radar report with no link opens the radar list', () => {
  const presented = presentNotification(
    row({ type: 'RadarReportNotification', title: '', action_url: null }),
    ORIGIN,
  );
  assert.equal(presented.mark, 'radar');
  assert.equal(presented.title, 'A radar report is ready');
  assert.deepEqual(presented.destination, { kind: 'internal', href: '/radars' });
});

test('a radar report with its own link keeps it', () => {
  const presented = presentNotification(
    row({ type: 'RadarReportNotification', action_url: '/radars/r-1/scans/s-1' }),
    ORIGIN,
  );
  assert.deepEqual(presented.destination, { kind: 'internal', href: '/radars/r-1/scans/s-1' });
});

test('the channel and message come from the stamped fields first', () => {
  const stamped = row({
    channel_uuid: 'c-stamped',
    message_uuid: 'm-stamped',
    action_url: '/channels/c-link?m=m-link',
  });
  assert.equal(notificationChannelUuid(stamped, ORIGIN), 'c-stamped');
  assert.equal(notificationMessageUuid(stamped, ORIGIN), 'm-stamped');
});

test('the channel and message are read off the link on an old row', () => {
  const old = row({ action_url: '/channels/c-link?m=m-link' });
  assert.equal(notificationChannelUuid(old, ORIGIN), 'c-link');
  assert.equal(notificationMessageUuid(old, ORIGIN), 'm-link');
});

test('a row that points into no channel says so', () => {
  const invite = row({ type: 'SpaceInviteNotification', action_url: '/space-invitations' });
  assert.equal(notificationChannelUuid(invite, ORIGIN), null);
  assert.equal(notificationMessageUuid(invite, ORIGIN), null);
  assert.equal(notificationChannelUuid(row({ action_url: 'https://example.org/channels/x' }), ORIGIN), null);
});
