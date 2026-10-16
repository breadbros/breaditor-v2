import {resolveSpriteUrl} from './spriteSource';
import type {MapCamera} from 'crustacean-map-lib';

export const MIN_MAP_ZOOM = 0.0625;
export const MAX_MAP_ZOOM = 16;

function storageKey(filepath: string, kind: 'mapZoom' | 'mapViewport'): string | null {
  if (!filepath) return null;
  return `breaditor.${kind}.v1.${resolveSpriteUrl(filepath, document.baseURI)}`;
}

function validZoom(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_MAP_ZOOM && value <= MAX_MAP_ZOOM;
}

export function loadMapZoom(filepath: string): number | null {
  const viewport = loadMapViewport(filepath);
  if (viewport) return viewport.zoom;
  try {
    const key = storageKey(filepath, 'mapZoom');
    const value: unknown = key ? JSON.parse(localStorage.getItem(key) || 'null') : null;
    return validZoom(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveMapZoom(filepath: string, zoom: number): void {
  if (!validZoom(zoom)) return;
  const viewport = loadMapViewport(filepath);
  if (viewport) {saveMapViewport(filepath, {...viewport, zoom}); return;}
  try {
    const key = storageKey(filepath, 'mapZoom');
    if (key) localStorage.setItem(key, JSON.stringify(zoom));
  } catch {
    // Zooming still works when browser storage is unavailable or full.
  }
}

export function loadMapViewport(filepath: string): MapCamera | null {
  try {
    const key = storageKey(filepath, 'mapViewport');
    const value = key ? JSON.parse(localStorage.getItem(key) || 'null') : null;
    if (value && typeof value.x === 'number' && Number.isFinite(value.x) &&
      typeof value.y === 'number' && Number.isFinite(value.y) && validZoom(value.zoom)) {
      return {x: value.x, y: value.y, zoom: value.zoom};
    }
  } catch { /* An invalid preference leaves the normal initial fit available. */ }
  return null;
}

export function saveMapViewport(filepath: string, camera: MapCamera): void {
  if (!Number.isFinite(camera.x) || !Number.isFinite(camera.y) || !validZoom(camera.zoom)) return;
  try {
    const key = storageKey(filepath, 'mapViewport');
    if (key) localStorage.setItem(key, JSON.stringify({x: camera.x, y: camera.y, zoom: camera.zoom}));
  } catch { /* Viewport changes still work when storage is unavailable or full. */ }
}
