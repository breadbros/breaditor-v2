import {resolveSpriteUrl} from './spriteSource';
import {spriteMaker} from './SpriteDocument';

test.each([
  ['D:\\My Sprites\\sprite #1.json', 'file:///D:/My%20Sprites/sprite%20%231.json'],
  ['D:/My Sprites/atlas.png', 'file:///D:/My%20Sprites/atlas.png'],
  ['\\\\server\\sprites\\atlas #1.png', 'file://server/sprites/atlas%20%231.png'],
  ['..\\images\\atlas.png', 'file:///D:/images/atlas.png'],
  ['https://example.test/sprite.json?v=2', 'https://example.test/sprite.json?v=2'],
  ['file:///D:/sprites/atlas%231.png', 'file:///D:/sprites/atlas%231.png'],
])('resolves sprite source %s', (source, expected) => {
  expect(resolveSpriteUrl(source, 'file:///D:/sprites/sprite.json')).toBe(expected);
});

test('new sprite documents use the bundled sample or the requested definition', () => {
  expect(spriteMaker('Sample')).toMatchObject({
    filepath: 'assets/lord-stan/lord_stan.json', animation: 'valid_looping_1',
    crustacean_json: null, crustacean_image: '',
  });
  expect(spriteMaker('Custom', 'D:\\sprites\\custom.json')).toMatchObject({
    filepath: 'D:\\sprites\\custom.json', animation: undefined,
  });
});
