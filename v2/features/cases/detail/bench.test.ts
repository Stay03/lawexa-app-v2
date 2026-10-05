import { test } from 'node:test';
import assert from 'node:assert/strict';
import { benchLabel, normalizeBench } from './authorities';

/* The presiding judge (backend d100069, techlead 4804e177): shown beside the
 * name, with the coram role when both apply. */
const judge = (over: object) =>
  ({ id: 1, name: 'Kudirat Kekere-Ekun JSC', slug: 'k', created_at: '', updated_at: '', ...over }) as never;

test('a presiding judge reads "presiding", and "presiding, lead" when also the lead', () => {
  assert.equal(benchLabel({ presiding: true, role: null }), 'presiding');
  assert.equal(benchLabel({ presiding: true, role: 'lead' }), 'presiding, lead');
  assert.equal(benchLabel({ presiding: false, role: 'dissenting' }), 'dissenting');
  assert.equal(benchLabel({ presiding: false, role: null }), null);
});

test('presiding is read only from a true value; false, absent and plain names are not presiding', () => {
  const [presides, absent, isFalse, plain] = normalizeBench([
    judge({ id: 1, presiding: true }),
    judge({ id: 2 }),
    judge({ id: 3, presiding: false }),
    'Paul Galumje JSC',
  ]);
  assert.equal(presides.presiding, true);
  assert.equal(absent.presiding, false);
  assert.equal(isFalse.presiding, false);
  assert.equal(plain.presiding, false);
});

/* Option 1 (owner, 5 October 2026): presiding first, then the lead, then the
 * rest as stored, the way a law report prints the panel. */
test('the presiding judge comes first, then the lead, then the rest as stored', () => {
  const bench = normalizeBench([
    judge({ id: 1, name: 'Umaru Atu Kalgo JSC' }),
    judge({ id: 2, name: 'Dennis Onyejife Edozie JCA' }),
    judge({ id: 3, name: 'Idris Legbo Kutigi', presiding: true }),
    judge({ id: 4, name: 'Aloysius Iyorgyer Katsina-Alu', role: 'lead' }),
    judge({ id: 5, name: 'Samson Odemwingie Uwaifo' }),
  ]);
  assert.deepEqual(
    bench.map((row) => row.name),
    [
      'Idris Legbo Kutigi',
      'Aloysius Iyorgyer Katsina-Alu',
      'Umaru Atu Kalgo JSC',
      'Dennis Onyejife Edozie JCA',
      'Samson Odemwingie Uwaifo',
    ],
  );
});

test('a judge who presided and wrote the lead is one row, first, with both labels', () => {
  const bench = normalizeBench([
    judge({ id: 1, name: 'Umaru Atu Kalgo JSC' }),
    judge({ id: 2, name: 'Kudirat Kekere-Ekun JSC', presiding: true, role: 'lead' }),
  ]);
  assert.equal(bench.length, 2);
  assert.equal(bench[0].name, 'Kudirat Kekere-Ekun JSC');
  assert.equal(benchLabel(bench[0]), 'presiding, lead');
});
