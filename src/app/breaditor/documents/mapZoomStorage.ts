import {resolveSpriteUrl} from './spriteSource';

export const MIN_MAP_ZOOM = 0.0625;
export const MAX_MAP_ZOOM = 16;

function storageKey(filepath: string): string | null {
  if (!filepath) return null;
  return `breaditor.mapZoom.v1.${resolveSpriteUrl(filepath, document.baseURI)}`;
}

function validZoom(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_MAP_ZOOM && value <= MAX_MAP_ZOOM;
}

export function loadMapZoom(filepath: string): number | null {
  try {
    const key = storageKey(filepath);
    const value: unknown = key ? JSON.parse(localStorage.getItem(key) || 'null') : null;
    return validZoom(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveMapZoom(filepath: string, zoom: number): void {
  try {
    const key = storageKey(filepath);
    if (key && validZoom(zoom)) localStorage.setItem(key, JSON.stringify(zoom));
  } catch {
    // Zooming still works when browser storage is unavailable or full.
  }
}
