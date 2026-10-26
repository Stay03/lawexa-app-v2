import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { homeSendFailure, unreachedMessage } from './home-send-failure';

/* Home's box when a new chat could not start (techlead, 26 October 2026):
 * Lucy's first question with a file got no answer and read "Network error.
 * Please try again." with nothing reported. No answer is now reported as
 * `send_network` and says the message and file are still there; an answer
 * with a status shows the API's own message. */

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

function noAnswer(code: string): AxiosError {
  return new AxiosError('Network Error', code, config, {});
}

function answered(status: number, data: unknown): AxiosError {
  const response = { status, statusText: '', data, headers: {}, config } as AxiosResponse;
  return new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', config, {}, response);
}

test('no answer says the message and its file are still here, and is reported', () => {
  const failure = homeSendFailure(noAnswer('ERR_NETWORK'), { attachments: 1, inSpace: false });
  assert.equal(failure.message, 'Couldn’t reach Lawexa. Your message and file are still here. Try again.');
  assert.deepEqual(failure.report, {
    code: 'send_network',
    message: 'A new chat from Home got no answer from the server (ERR_NETWORK).',
    conversationId: null,
  });
});

test('the words follow what the box holds', () => {
  assert.equal(unreachedMessage(0), 'Couldn’t reach Lawexa. Your message is still here. Try again.');
  assert.equal(unreachedMessage(3), 'Couldn’t reach Lawexa. Your message and files are still here. Try again.');
});

test('a timeout is no answer too, in a space as well', () => {
  const failure = homeSendFailure(noAnswer('ECONNABORTED'), { attachments: 0, inSpace: true });
  assert.equal(failure.message, unreachedMessage(0));
  assert.equal(failure.report?.code, 'send_network');
});

test('an answer shows the API’s own message and is not reported', () => {
  const failure = homeSendFailure(
    answered(500, { success: false, message: 'The chat service is busy.' }),
    { attachments: 1, inSpace: false },
  );
  assert.deepEqual(failure, { message: 'The chat service is busy.', report: null });
});

test('an answer without the API’s envelope names its status', () => {
  const failure = homeSendFailure(answered(502, '<html>Bad Gateway</html>'), { attachments: 0, inSpace: false });
  assert.deepEqual(failure, { message: 'Lawexa couldn’t start the chat (error 502). Try again.', report: null });
});

test('in a space, a Viewer’s 403 keeps the space’s words; a 500 keeps the API’s', () => {
  assert.equal(
    homeSendFailure(answered(403, { message: 'Forbidden' }), { attachments: 0, inSpace: true }).message,
    'Only the Owner and Contributors can start conversations here.',
  );
  assert.equal(
    homeSendFailure(answered(500, { message: 'Server error.' }), { attachments: 0, inSpace: true }).message,
    'Server error.',
  );
});
