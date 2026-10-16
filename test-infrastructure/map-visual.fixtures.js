// Expected rows are hand-authored scene diagrams, never renderer captures.
const palette = {
  '.': [0, 0, 0, 0], G: [24, 112, 48, 255], B: [128, 64, 16, 255],
  R: [224, 32, 32, 255], U: [0, 224, 224, 255], N: [32, 32, 224, 255],
  W: [0, 64, 255, 255], F: [128, 192, 255, 255], A: [255, 255, 255, 255],
  S: [255, 224, 0, 255], C: [0, 192, 0, 255], T: [96, 48, 0, 255],
  V: [160, 32, 192, 255], H: [255, 128, 0, 255], Y: [224, 192, 0, 255],
};
const layer = (name, width, height, extra = {}) => ({name, dimensions: {X: width, Y: height}, vsp: 'art', parallax: {X: 0, Y: 0}, ...extra});
const cells = (width, height, edits = [], fill = 0) => {
  const values = new Array(width * height).fill(fill);
  for (const [x, y, tile] of edits) values[y * width + x] = tile;
  return values;
};
const character = (rows, hitbox, extra = {}) => ({rows, raw: {
  dims: [rows[0].length, rows.length], hitbox, frames: 1, per_row: 1,
  inner_pad: 0, outer_pad: 0, image: 'fixture.png', animations: {Still: [0, 'Static']}, ...extra,
}});
const entity = (filename, px, py, name = 'Entity Layer (E)', extra = {}) => ({filename, animation: 'Still', location: {layer: name, px, py, ...extra}});

const bridge = {
  name: 'bridge-underpass-and-rails', width: 12, height: 10, camera: {x: 0, y: 0, zoom: 1},
  atlas: ['..GGBBRR', '..GGBB..'],
  layers: [layer('Ground', 6, 5), layer('Deck', 6, 5), layer('Rails', 6, 5), layer('Underpass', 6, 5)],
  data: [cells(6, 5, [], 1), cells(6, 5, [1, 2, 3, 4].map(x => [x, 2, 2])), cells(6, 5, [1, 2, 3, 4].map(x => [x, 2, 3])), cells(6, 5)],
  sprites: {'under.json': character(['UU', 'UU', 'UU', 'UU'], [0, 3, 2, 1]), 'over.json': character(['NN', 'NN', 'NN', 'NN'], [0, 3, 2, 1])},
  entities: [entity('under.json', 3, 6, 'Underpass'), entity('over.json', 7, 6)], renderstring: '1,4,2,E,3',
  frames: [{timeMs: 0, rows: [
    'GGGGGGGGGGGG', 'GGGGGGGGGGGG', 'GGGGGGGGGGGG', 'GGGUUGGNNGGG', 'GGRRRRRRRRGG',
    'GGBBBBBNNBGG', 'GGGUUGGNNGGG', 'GGGGGGGGGGGG', 'GGGGGGGGGGGG', 'GGGGGGGGGGGG',
  ]}],
};

const waterRows = ['GGWWWWGGGGGG', 'GGWWWWGGGGGG', 'GGWWWWGGGGGG', 'GGWWWWGGGGGG', 'GGWWWWGGGGGG', 'GGWWWWGGGGGG', 'GGGAAGGGGGGG', 'GGAAAAGGGGGG'];
const alternateWaterRows = ['GGFFFFGGGGGG', 'GGFFFFGGGGGG', 'GGFFFFGGGGGG', 'GGFFFFGGGGGG', 'GGFFFFGGGGGG', 'GGFFFFGGGGGG', 'GGGSSGGGGGGG', 'GGSSSSGGGGGG'];
const waterfall = {
  name: 'waterfall-tile-and-splash-animation', width: 12, height: 8, camera: {x: 0, y: 0, zoom: 1},
  atlas: ['..GGWWFF', '..GGWWFF'], animations: [{start: 2, end: 3, delay: 10, mode: 0}],
  layers: [layer('Ground', 6, 4), layer('Waterfall', 6, 4)],
  data: [cells(6, 4, [], 1), cells(6, 4, [0, 1, 2].flatMap(y => [[1, y, 2], [2, y, 2]]))],
  sprites: {'splash.json': {rows: ['.AA..SS.', 'AAAASSSS'], raw: {dims: [4, 2], hitbox: [0, 0, 4, 2], frames: 2, per_row: 2, inner_pad: 0, outer_pad: 0,
    image: 'splash.png', animations: {Flow: ['T10 0 T10 1', 'Looping']}}}},
  entities: [{...entity('splash.json', 2, 6), animation: 'Flow'}], renderstring: '1,2,E',
  frames: [0, 99, 100, 199, 200, 100].map(timeMs => ({timeMs, rows: timeMs === 100 || timeMs === 199 ? alternateWaterRows : waterRows})),
};

const oak = {
  name: 'oak-hidden-canopy-target-and-transforms', width: 14, height: 12, camera: {x: 4, y: 2, zoom: 1},
  atlas: ['..GGVVHHYY', '..GGVVHHYY'],
  layers: [layer('Ground', 7, 6), layer('Trees', 7, 6, {offset: {X: 2, Y: 2}, parallax: {X: 0.5, Y: 0.5}}),
    layer('Crossing', 7, 6), layer('Hidden canopy target', 7, 6, {MAPED_HIDDEN: true}), layer('Later fence', 7, 6)],
  data: [cells(7, 6, [], 1), cells(7, 6), cells(7, 6, [1, 2, 3, 4].map(x => [x, 2, 2]).concat([[2, 4, 2], [3, 4, 2]])),
    cells(7, 6, [], 3), cells(7, 6, [[3, 3, 4]])],
  sprites: {
    'oak.json': {rows: ['........', '..CCCC..', '.CCCCCC.', '.CCCCCC.', '..CCCC..', '...TT...', '...TT...', '...TT...', '...TT...', '........'],
      raw: {dims: [6, 8], hitbox: [2, 6, 2, 2], frames: 1, per_row: 1, inner_pad: 1, outer_pad: 1, image: 'oak.png',
        regions: {Tall_Redraw: [1, 0, 4, 4]}, animations: {Still: [0, 'Static']}}},
    'hidden.json': character(['HH', 'HH'], [0, 0, 2, 2]),
  },
  // Pixel coordinates win over deliberately conflicting tile coordinates.
  entities: [entity('oak.json', 5, 8, 'Trees', {tx: 99, ty: 99}), entity('hidden.json', 0, 0, 'Hidden canopy target')],
  renderstring: '1,2,3,4,5', tallentitylayer: 'Hidden canopy target',
  frames: [{timeMs: 0, rows: [
    'GGGGGGGGGGGGGG', 'GGGGGGGGGGGGGG', 'GGGGGGGGGGGGGG', 'GGGGCCCCGGGGGG',
    'GGVVCCCCVVGGGG', 'GGVVCCCCVVGGGG', 'GGGGCCYYGGGGGG', 'GGGGGTYYGGGGGG',
    'GGGGVVVVGGGGGG', 'GGGGVVVVGGGGGG', 'GGGGGTTGGGGGGG', 'GGGGGGGGGGGGGG',
  ]}],
};

module.exports = {palette, scenes: [bridge, waterfall, oak]};
