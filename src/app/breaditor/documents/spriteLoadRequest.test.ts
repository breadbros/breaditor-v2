import {loadSpriteDefinition} from 'crustacean-sprite-lib/load';
import type {CrustyV1} from 'crustacean-sprite-lib';
import {spriteMaker} from './SpriteDocument';
import {spriteLoadRequest} from './spriteSource';

test.each(['object', 'text'])('loads inline %s sprite data with the same source options as the preview', async format => {
  const sprite = spriteMaker('Inline', 'sprites/test.json');
  const source: CrustyV1 = {
    version: 1, image: 'atlas.png', dims: [8, 8],
    hitbox: [0, 0, 8, 8],
    frames: 1, per_row: 1, inner_pad: 0, outer_pad: 0,
    animations: {still: [0, 'Static']},
  };
  sprite.crustacean_json = format === 'object' ? source : '// Sprite definition\n' + JSON.stringify(source);
  sprite.crustacean_image = 'override.png';
  const abort = new AbortController();
  const {url, options} = spriteLoadRequest(sprite, 'https://example.test/app/', abort.signal);
  const loaded = await loadSpriteDefinition(url, options);
  expect(loaded.definition.width).toBe(8);
  expect(loaded.definition.animations.still.mode).toBe('Static');
  expect(loaded.definition.animations.still.instructions).toEqual([expect.objectContaining({frame: 0})]);
  expect(loaded.definitionUrl).toBe('https://example.test/app/sprites/test.json');
  expect(loaded.imageUrl).toBe('https://example.test/app/sprites/override.png');
  abort.abort();
  await expect(loadSpriteDefinition(url, options)).rejects.toHaveProperty('name', 'AbortError');
});
