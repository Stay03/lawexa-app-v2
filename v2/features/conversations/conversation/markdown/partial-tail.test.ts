import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trimUnclosedLinkTail } from './partial-tail';

/* A stopped answer must not end in half a link (techlead a80ed58a). */
const lead = 'The promisee must have acted on the promise to their detriment';

test('a citation cut inside its address is dropped, the sentence kept', () => {
  assert.equal(
    trimUnclosedLinkTail(`${lead} [[1]](https://lawexa.com/notes/the-doctrine-of-equitable-estopp`),
    lead,
  );
});

test('a link cut inside its label or right after it is dropped', () => {
  assert.equal(trimUnclosedLinkTail(`${lead} [Okafor v Nwe`), lead);
  assert.equal(trimUnclosedLinkTail(`${lead} [[1]]`), lead);
  assert.equal(trimUnclosedLinkTail(`${lead} [[1`), lead);
  assert.equal(trimUnclosedLinkTail(`${lead} [Okafor v Nweke](`), lead);
});

test('a complete link at the end is kept', () => {
  const done = `${lead} [[1]](https://lawexa.com/notes/estoppel).`;
  assert.equal(trimUnclosedLinkTail(done), done);
  const named = `See [Okafor v Nweke](https://lawexa.com/cases/okafor-v-nweke)`;
  assert.equal(trimUnclosedLinkTail(named), named);
});

test('ordinary brackets earlier in the answer are left alone', () => {
  const prose = 'He said [sic] that\nthe court was wrong';
  assert.equal(trimUnclosedLinkTail(prose), prose);
  const plain = 'No links here at all.';
  assert.equal(trimUnclosedLinkTail(plain), plain);
  const aside = `${lead} [as amended] and more text`;
  assert.equal(trimUnclosedLinkTail(aside), aside);
});
