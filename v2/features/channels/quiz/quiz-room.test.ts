import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { relayQuizGameEvents, subscribeToQuizGameEvents, type QuizGameEvent, type QuizEventSource } from './game-bus';
import { channelRoom, gameInRoom, goLivePayload, quizRoomKey, roomNoun, spaceRoom } from './quiz-room';

/* Live quiz in Spaces (Arthur's decisions 93142269; Backend's shapes
 * 7a007a8c): the game screens are generalised once to a room, a channel or a
 * Space itself, rather than copied. TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('a room is a channel or a Space, and the same uuid in each is two rooms', () => {
  assert.deepEqual(channelRoom('u1'), { kind: 'channel', uuid: 'u1' });
  assert.deepEqual(spaceRoom('u1'), { kind: 'space', uuid: 'u1' });
  assert.notEqual(quizRoomKey(channelRoom('u1')), quizRoomKey(spaceRoom('u1')));
  assert.equal(roomNoun(channelRoom('u1')), 'channel');
  assert.equal(roomNoun(spaceRoom('u1')), 'Space');
});

test('go-live names the room on screen: a channel, or a Space with the chat it started from', () => {
  assert.deepEqual(goLivePayload(channelRoom('c1')), { channel_uuid: 'c1' });
  // A channel game never names a chat, even if one is passed.
  assert.deepEqual(goLivePayload(channelRoom('c1'), 'conv-1'), { channel_uuid: 'c1' });
  assert.deepEqual(goLivePayload(spaceRoom('s1')), { space_uuid: 's1' });
  assert.deepEqual(goLivePayload(spaceRoom('s1'), 'conv-1'), { space_uuid: 's1', conversation_uuid: 'conv-1' });
});

test('a game belongs to the room it is played in, never to the other kind', () => {
  const channelGame = { channel_uuid: 'c1', space_uuid: null };
  const spaceGame = { channel_uuid: null, space_uuid: 's1' };
  assert.equal(gameInRoom(channelGame, channelRoom('c1')), true);
  assert.equal(gameInRoom(channelGame, channelRoom('c2')), false);
  assert.equal(gameInRoom(spaceGame, spaceRoom('s1')), true);
  assert.equal(gameInRoom(spaceGame, channelRoom('s1')), false);
  // A server before Spaces sends no space_uuid: a channel game still matches its channel.
  assert.equal(gameInRoom({ channel_uuid: 'c1' }, channelRoom('c1')), true);
  assert.equal(gameInRoom({ channel_uuid: 'c1' }, spaceRoom('c1')), false);
});

/** A stand-in for an Echo channel: records what is listened to, and plays events. */
function fakeSource() {
  const handlers = new Map<string, Set<(payload: never) => void>>();
  const source: QuizEventSource = {
    listen(event, callback) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(callback);
    },
    stopListening(event, callback) {
      if (callback) handlers.get(event)?.delete(callback);
    },
  };
  const emit = (event: string, payload: unknown) => {
    for (const handler of handlers.get(event) ?? []) handler(payload as never);
  };
  const count = () => [...handlers.values()].reduce((sum, set) => sum + set.size, 0);
  return { source, emit, count };
}

test('the relay puts all eight events on the room\'s bus, and refreshes the probe on live, finished and cancelled', () => {
  const { source, emit, count } = fakeSource();
  const room = spaceRoom('s1');
  const seen: QuizGameEvent['type'][] = [];
  const otherRoom: QuizGameEvent['type'][] = [];
  const unsubscribe = subscribeToQuizGameEvents(room, (event) => seen.push(event.type));
  const unsubscribeOther = subscribeToQuizGameEvents(channelRoom('s1'), (event) => otherRoom.push(event.type));
  let probes = 0;
  const stop = relayQuizGameEvents(source, room, () => {
    probes += 1;
  });
  assert.equal(count(), 8);

  for (const name of ['live', 'player_joined', 'countdown', 'question_opened', 'answer_progress', 'question_closed', 'finished', 'cancelled']) {
    emit(`.quiz.game.${name}`, name === 'live' ? { game: { uuid: 'g1' } } : { game_uuid: 'g1' });
  }
  assert.deepEqual(seen, ['live', 'player_joined', 'countdown', 'question_opened', 'answer_progress', 'question_closed', 'finished', 'cancelled']);
  assert.equal(probes, 3);
  // A channel with the same uuid hears nothing of the Space's game.
  assert.deepEqual(otherRoom, []);

  // The cleanup stops only these eight: a Space's channel stays for its other listeners.
  stop();
  assert.equal(count(), 0);
  unsubscribe();
  unsubscribeOther();
});

test('both rooms use the one relay; a Space shares its channel with the task board', () => {
  const roomTs = read('v2', 'features', 'channels', 'room.ts');
  assert.match(roomTs, /relayQuizGameEvents\(room, quizRoom, \(\) => \{/);
  assert.doesNotMatch(roomTs, /room\.listen\('\.quiz\.game\./);
  const space = read('v2', 'features', 'channels', 'quiz', 'use-space-quiz-live.ts');
  assert.match(space, /retainChannel\(name\);\s*const stop = relayQuizGameEvents\(channel, room, \(\) => \{/);
  assert.match(space, /stop\(\);\s*if \(releaseChannel\(name\) === 0\) echo\.leave\(name\);/);
  const board = read('v2', 'features', 'spaces', 'detail', 'tasks', 'use-task-board-live.ts');
  assert.match(board, /from '@\/v2\/runtime\/realtime\/channel-listeners'/);
  // The probe's path follows the room.
  const api = read('lib', 'api', 'channel-quiz.ts');
  assert.match(api, /const scope = room\.kind === 'channel' \? 'channels' : 'spaces';/);
});
