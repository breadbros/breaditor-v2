import type {MapEditableAsset} from './mapEditing';

export interface MapRenderPass {token: string; renderIndex: number; layerIndex?: number}

/** Foreground first, matching the legacy Layers palette. Indices refer to the original renderstring. */
export function mapRenderStack(asset: MapEditableAsset): MapRenderPass[] {
  return asset.map.renderstring.split(',').map((raw, renderIndex) => {
    const token = raw.trim(), index = /^\d+$/.test(token) ? Number(token) - 1 : -1;
    return {token, renderIndex, layerIndex: asset.map.layers[index] ? index : undefined};
  }).filter(pass => pass.token !== '').reverse();
}

/** Move a draw pass, never the layer storage or its bound tile data. */
export function moveMapRenderPass(asset: MapEditableAsset, from: number, to: number) {
  const tokens = asset.map.renderstring.split(',');
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 ||
      from >= tokens.length || to >= tokens.length || from === to || !tokens[from].trim() || !tokens[to].trim()) return;
  const [token] = tokens.splice(from, 1);
  tokens.splice(to, 0, token);
  asset.map.renderstring = tokens.join(',');
}
