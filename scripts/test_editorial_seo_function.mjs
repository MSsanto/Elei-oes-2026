import assert from 'node:assert/strict';
import { canonicalEditorialPath, editorialAssetPath, parseEditorialRoute } from '../functions/candidatos/[[path]].js';

assert.deepEqual(parseEditorialRoute(['deputado-federal']), { cargo: 'deputado-federal', uf: '', partySlug: '' });
assert.deepEqual(parseEditorialRoute(['deputado-federal', 'SP']), { cargo: 'deputado-federal', uf: 'sp', partySlug: '' });
assert.deepEqual(parseEditorialRoute(['presidente', 'partido', 'novo']), { cargo: 'presidente', uf: '', partySlug: 'novo' });
assert.deepEqual(parseEditorialRoute(['governador', 'RJ', 'partido', 'psd']), { cargo: 'governador', uf: 'rj', partySlug: 'psd' });
assert.equal(parseEditorialRoute(['cargo-invalido']), null);
assert.equal(parseEditorialRoute(['deputado-federal', 'sp', 'qualquer', 'psd']), null);

assert.equal(
  canonicalEditorialPath({ cargo: 'deputado-federal', uf: 'sp', partySlug: 'psd' }),
  '/candidatos/deputado-federal/sp/partido/psd',
);
assert.equal(
  editorialAssetPath({ cargo: 'deputado-federal', uf: 'sp', partySlug: 'psd' }),
  '/data/seo/editorial/pages/deputado-federal/sp/partido/psd.json',
);
assert.equal(
  editorialAssetPath({ cargo: 'presidente', uf: '', partySlug: '' }),
  '/data/seo/editorial/pages/presidente/index.json',
);

console.log('Helpers SEO editorial da Pages Function validados.');
