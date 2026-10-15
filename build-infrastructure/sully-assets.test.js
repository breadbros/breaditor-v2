const fs = require('fs');
const path = require('path');
const {collectAssetPaths, verifyAssets, resolveDependency} = require('./sully-assets');

const root = path.resolve(__dirname, '../assets/sully');

test('bundled Farmsville resolves every dependency and matches recorded source hashes', () => {
  const manifest = verifyAssets(root);
  expect(manifest.assets).toHaveLength(107);
  expect(manifest.source.revision).toMatch(/^[a-f0-9]{40}$/);
  const extensions = manifest.assets.reduce((counts, asset) => {
    const ext = path.extname(asset.path);
    counts[ext] = (counts[ext] || 0) + 1;
    return counts;
  }, {});
  expect(extensions).toEqual({'.json': 55, '.png': 52});
  expect(collectAssetPaths(root)).toEqual(manifest.assets.map(asset => asset.path));
});

test('bundle retains map layer surplus and source metadata without rewriting JSON', () => {
  const map = JSON.parse(fs.readFileSync(path.join(root, 'maps/json/farmsville.map.json'), 'utf8'));
  const data = JSON.parse(fs.readFileSync(path.join(root, 'maps/json/farmsville.map.data.json'), 'utf8'));
  expect(map.layers).toHaveLength(6);
  expect(data.tile_data).toHaveLength(7);
  expect(map.notes.length).toBeGreaterThan(0);
  expect(new Set(map.entities.map(entity => entity.filename)).size).toBe(50);
});

test('dependency resolution permits relative images while rejecting content-root escapes', () => {
  expect(resolveDependency('chrs/objects/chest.json', '../shared/chest.png')).toBe('chrs/shared/chest.png');
  expect(() => resolveDependency('maps/a.json', '../../outside.png')).toThrow('escapes content root');
  expect(() => resolveDependency('map.json', 'D:/outside.png')).toThrow('escapes content root');
});
