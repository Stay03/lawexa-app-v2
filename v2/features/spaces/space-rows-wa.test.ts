import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The room rows after Stay's WhatsApp ask (18 October 2026, 01:50 UTC):
 * "Look at how WhatsApp placed their time and unread count cleanly ... I want
 * the last text of the channel/thread at the bottom subtext instead of the
 * name of the channel/thread. I also think you should change the location of
 * the status to use space well". */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const rows = () => read('v2', 'features', 'spaces', 'detail', 'content', 'feed-rows.tsx');

test('the @you count sits under the time, ending line 2', () => {
  const source = rows();
  assert.match(
    source,
    /<span className="min-w-0 flex-1 text-xs text-muted-foreground">\s*<span className="block max-w-2xl truncate">\{line\.meta\}<\/span>\s*<\/span>\s*\{mentions > 0 \? \(\s*<CountBadge/,
  );
  // Never in the menu column any more.
  assert.doesNotMatch(source, /line\.menu \?\?\s*\(/);
});

test('a room’s line 2 is what was last said, "Sender: text"', () => {
  const source = rows();
  assert.match(source, /if \(room\.last_message\) return <LastMessagePreview preview=\{room\.last_message\} \/>;/);
  assert.match(source, /return fallback \?\? 'No messages yet';/);
  // A channel without one says what it is for; a thread has no fallback.
  assert.match(source, /meta: roomLastLine\(channel, channel\.description\?\.trim\(\) \|\| null\),/);
  assert.match(source, /meta: roomLastLine\(thread, null\),/);
  // The parent channel's name is gone from the thread's line.
  assert.doesNotMatch(source, /parent_channel_name/);
});

test('the status sits after the name: a thread’s dot and word, a channel’s thread counts', () => {
  const source = rows();
  assert.match(source, /\{line\.status \? \(\s*<span className="flex max-w-\[55%\] shrink-0 items-center text-xs text-muted-foreground">\{line\.status\}<\/span>/);
  assert.match(source, /status: channelStatusCountsLine\(channel\.thread_status_counts\) \?\? undefined,/);
});
