const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {execFileSync} = require('child_process');

const mapPath = 'maps/json/farmsville.map.json';
const configPath = 'maps/json/$$$_maped.json';
const bundleRoot = path.resolve(__dirname, '../assets/sully');

function resolveDependency(definition, reference) {
  if (typeof reference !== 'string' || !reference) throw new Error(`Invalid reference in ${definition}`);
  if (/^(?:[a-z]:|[\\/])/i.test(reference)) throw new Error(`Dependency escapes content root: ${reference}`);
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(definition), reference.replace(/\\/g, '/')));
  if (resolved === '..' || resolved.startsWith('../') || path.posix.isAbsolute(resolved) || /^[a-z]:/i.test(resolved)) {
    throw new Error(`Dependency escapes content root: ${reference}`);
  }
  return resolved;
}

// References are intentionally resolved using Sully's existing conventions.
function collectAssetPaths(root) {
  const files = new Set([mapPath, mapPath.replace(/\.map\.json$/, '.map.data.json'), configPath]);
  const read = filename => JSON.parse(fs.readFileSync(path.join(root, filename), 'utf8'));
  const map = read(mapPath);
  for (const reference of Object.values(map.vsp || {})) {
    const filename = resolveDependency(mapPath, reference);
    files.add(filename);
    files.add(resolveDependency(filename, read(filename).source_image));
  }
  const contentRoot = resolveDependency(configPath, `${read(configPath).path_to_chrs}/__root__`);
  for (const entity of map.entities || []) {
    if (!entity.filename) continue;
    const filename = resolveDependency(contentRoot, entity.filename);
    files.add(filename);
    files.add(resolveDependency(filename, read(filename).image));
  }
  return [...files].sort();
}

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function verifyAssets(root = bundleRoot) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'asset-manifest.json'), 'utf8'));
  const expected = collectAssetPaths(root);
  if (JSON.stringify(expected) !== JSON.stringify(manifest.assets.map(asset => asset.path))) {
    throw new Error('Manifest does not match the Farmsville dependency closure');
  }
  for (const asset of manifest.assets) {
    const bytes = fs.readFileSync(path.join(root, asset.path));
    if (bytes.length !== asset.bytes || digest(bytes) !== asset.sha256) {
      throw new Error(`Asset integrity check failed: ${asset.path}`);
    }
  }
  return manifest;
}

function copyAssets(source, destination = bundleRoot) {
  const files = collectAssetPaths(source);
  // Read all inputs before writing so a missing dependency cannot produce a partial copy.
  const assets = files.map(filename => ({path: filename, bytes: fs.readFileSync(path.join(source, filename))}));
  const revision = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
  for (const asset of assets) {
    const target = path.join(destination, asset.path);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, asset.bytes);
  }
  const manifest = {
    format_version: 1,
    source: {repository: 'https://github.com/breadbros/SullyRPG', revision, content_root: 'Examples/Sully/SullyContent'},
    map: mapPath,
    assets: assets.map(asset => ({path: asset.path, bytes: asset.bytes.length, sha256: digest(asset.bytes)})),
  };
  fs.writeFileSync(path.join(destination, 'asset-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return verifyAssets(destination);
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const manifest = args[0] === '--copy' ? copyAssets(path.resolve(args[1]), args[2] && path.resolve(args[2]))
      : args[0] === '--verify' ? verifyAssets(args[1] && path.resolve(args[1]))
      : (() => {throw new Error('Usage: node build-infrastructure/sully-assets.js --copy <SullyContent> [destination] | --verify [bundle]');})();
    console.log(`Verified ${manifest.assets.length} Farmsville assets (${manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0)} bytes).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {collectAssetPaths, verifyAssets, resolveDependency};
