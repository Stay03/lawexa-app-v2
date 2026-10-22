/**
 * The working row's words while a redacted chat's message is being redacted
 * (Stay, 22 October 2026, option A). The server redacts it inside the request
 * that sends it, before any answer streams: on the home screen for a new
 * chat's first message, in the chat for every later one. Both say the same.
 */
export const REDACTING_LABEL = 'Removing personal details…';
