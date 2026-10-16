import {createEmptyMap, adaptLegacySprite, loadMap} from 'crustacean-map-lib';
import {WebGLMapRenderer} from 'crustacean-map-lib/webgl';

function image(rows, palette) {
  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length; canvas.height = rows.length;
  const context = canvas.getContext('2d'), data = context.createImageData(canvas.width, canvas.height);
  rows.forEach((row, y) => [...row].forEach((symbol, x) => data.data.set(palette[symbol], (y * canvas.width + x) * 4)));
  context.putImageData(data, 0, 0);
  return canvas.toDataURL('image/png');
}

export async function renderScene(scene, palette) {
  const canvas = document.getElementById('map'), renderer = new WebGLMapRenderer(canvas), asset = createEmptyMap();
  try {
    asset.map = {...asset.map, dimensions: {X: scene.width / 2, Y: scene.height / 2}, tile_size: {width: 2, height: 2},
      vsp: {art: 'art.json'}, layers: scene.layers, entities: scene.entities, renderstring: scene.renderstring,
      tallentitylayer: scene.tallentitylayer};
    asset.data.tile_data = scene.data;
    asset.tilesets.art = {definition: {tilesize: {width: 2, height: 2}, tiles_per_row: scene.atlas[0].length / 2,
      source_image: 'art.png', animations: scene.animations || []}, definitionUrl: 'https://fixture.invalid/art.json', imageUrl: image(scene.atlas, palette)};
    for (const [name, sprite] of Object.entries(scene.sprites)) asset.sprites[name] = {
      raw: sprite.raw, definition: adaptLegacySprite(sprite.raw), regions: sprite.raw.regions,
      definitionUrl: `https://fixture.invalid/${name}`, imageUrl: image(sprite.rows, palette),
    };
    await renderer.load(asset);
    const gl = canvas.getContext('webgl2'), frames = [];
    for (const frame of scene.frames) {
      renderer.render(scene.camera, {width: scene.width, height: scene.height, timeMs: frame.timeMs, pixelRatio: 1});
      const bottomUp = new Uint8Array(scene.width * scene.height * 4), rgba = [];
      gl.readPixels(0, 0, scene.width, scene.height, gl.RGBA, gl.UNSIGNED_BYTE, bottomUp);
      for (let y = scene.height - 1; y >= 0; y--) rgba.push(...bottomUp.subarray(y * scene.width * 4, (y + 1) * scene.width * 4));
      frames.push({timeMs: frame.timeMs, rgba, actualPng: canvas.toDataURL('image/png'), error: gl.getError()});
    }
    return frames;
  } finally {renderer.dispose();}
}

// Observational captures, deliberately excluded from golden acceptance.
export async function captureFarmsville() {
  const asset = await loadMap(`${location.origin}/content/maps/json/farmsville.map.json`);
  const canvas = document.getElementById('map'), renderer = new WebGLMapRenderer(canvas), captures = [];
  try {
    await renderer.load(asset);
    for (const focus of [
      {name: 'farmsville-bridge-observation', x: 880, y: 880, zoom: 1},
      {name: 'farmsville-waterfall-observation', x: 760, y: 720, zoom: 2},
      {name: 'farmsville-oak-observation', x: 680, y: 400, zoom: 2},
    ]) {
      renderer.render(focus, {width: 480, height: 400, timeMs: 1000, pixelRatio: 1});
      captures.push({name: focus.name, png: canvas.toDataURL('image/png')});
    }
    return captures;
  } finally {renderer.dispose();}
}
