import assert from 'node:assert/strict';
import { candidateShard, canonicalCandidatePath } from '../functions/candidato/[id].js';

assert.equal(candidateShard('250002539328'), '28');
assert.equal(candidateShard('7'), '07');

assert.equal(
  canonicalCandidatePath({ id_tse: '123', cargo_slug: 'deputado-federal', uf: 'SP' }),
  '/candidato/123?cargo=deputado-federal',
);
assert.equal(
  canonicalCandidatePath({ id_tse: '456', cargo_slug: 'governador', uf: 'RJ' }),
  '/candidato/456?cargo=governador&uf=RJ',
);
assert.equal(
  canonicalCandidatePath({ id_tse: '789', cargo_slug: 'deputado-estadual', uf: 'DF' }, 'financas'),
  '/candidato/789?cargo=deputado-estadual&uf=DF&aba=financas',
);
assert.equal(
  canonicalCandidatePath({ id_tse: '789', cargo_slug: 'deputado-estadual', uf: 'DF' }, 'qualquer-coisa'),
  '/candidato/789?cargo=deputado-estadual&uf=DF',
);

console.log('Helpers SEO da Pages Function validados.');
