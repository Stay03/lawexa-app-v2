const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '..', 'conv.json');
const d = JSON.parse(fs.readFileSync(file, 'utf8'));

function findMessages(obj, depth = 0) {
  if (!obj || depth > 6) return null;
  if (Array.isArray(obj)) return null;
  if (typeof obj !== 'object') return null;
  if (Array.isArray(obj.messages) && obj.messages.length && obj.messages[0].role) return obj.messages;
  for (const k of Object.keys(obj)) {
    const r = findMessages(obj[k], depth + 1);
    if (r) return r;
  }
  return null;
}

const msgs = findMessages(d) || [];
console.log('TOP KEYS:', Object.keys(d));
console.log('TOTAL MESSAGES:', msgs.length);
console.log('');

const byMeta = new Map();
for (const m of msgs) {
  const meta = m.metadata;
  const t = meta === null ? 'NULL' : (meta && meta.type) ? meta.type : (typeof meta === 'undefined' ? 'undef' : 'other');
  byMeta.set(t, (byMeta.get(t) || 0) + 1);
}
console.log('METADATA TYPE COUNTS:');
for (const [k, v] of byMeta) console.log('  ', k, '=', v);
console.log('');

const fragments = [
  'Now let me consult the Case Research Agent',
  'Now let me consult the Statute Research Agent',
  'Let me try a different approach and consult the Web Search Agent',
  'I now have comprehensive information',
  'But first, let me synthesize the legal position',
  'SYNTHESIS OF LEGAL POSITION',
];

console.log('SEARCH FOR DISAPPEARED FRAGMENTS:');
for (const frag of fragments) {
  const hits = msgs
    .map((m, i) => ({ i, m }))
    .filter(({ m }) => typeof m.content === 'string' && m.content.includes(frag));
  if (hits.length === 0) {
    console.log(`  MISSING FROM DB: "${frag}"`);
  } else {
    for (const { i, m } of hits) {
      const meta = m.metadata;
      const t = meta === null ? 'NULL (response)' : (meta && meta.type) ? `type=${meta.type}` : 'undef';
      console.log(`  [msg#${i} id=${m.id} role=${m.role} agent=${m.agent_slug || '-'} len=${m.content.length} meta=${t}] "${frag}"`);
    }
  }
}
console.log('');

console.log('ALL ASSISTANT MESSAGES (summary):');
msgs.forEach((m, i) => {
  if (m.role !== 'assistant') return;
  const meta = m.metadata;
  const t = meta === null ? 'NULL' : (meta && meta.type) ? meta.type : 'undef';
  const c = (m.content || '').replace(/\s+/g, ' ');
  console.log(
    String(i).padStart(3),
    'id=' + (m.id || '?'),
    'meta=' + t,
    'agent=' + (m.agent_slug || '-'),
    'len=' + (m.content?.length || 0),
    '|',
    c.slice(0, 160)
  );
});
