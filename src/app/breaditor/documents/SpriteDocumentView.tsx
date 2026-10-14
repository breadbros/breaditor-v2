import React, {useEffect, useRef, useState} from 'react';
import {SpritePlayer, PlayerSnapshot} from 'crustacean-sprite-lib';
import {WebGLSpriteRenderer, WebGLSprite, WebGLLoadOptions} from 'crustacean-sprite-lib/webgl';
import type {SpriteDocument} from './SpriteDocument';
import {resolveSpriteUrl} from './spriteSource';

// @ts-ignore
import css from './SpriteDocumentView.module.css';

interface Preview {
  player: SpritePlayer;
  resetClock: () => void;
  draw: () => void;
}

export function SpriteDocumentView({document: sprite}: {document: SpriteDocument}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<Preview | null>(null);
  const zoomRef = useRef(4);
  const [zoom, setZoom] = useState(4);
  const [animations, setAnimations] = useState<string[]>([]);
  const [playback, setPlayback] = useState<PlayerSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const viewport = viewportRef.current!;
    const abort = new AbortController();
    let renderer: WebGLSpriteRenderer | undefined;
    let asset: WebGLSprite | undefined;
    let request: number | undefined;
    let previousTime: number | undefined;
    let fraction = 0;
    let width = 1;
    let height = 1;
    let pixelRatio = 1;

    setError(null);
    setRestoring(false);
    setPlayback(null);
    setAnimations([]);

    function resetClock() {
      previousTime = undefined;
      fraction = 0;
    }

    function resize() {
      width = Math.max(1, viewport.clientWidth);
      height = Math.max(1, viewport.clientHeight);
      pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
    }

    function fail(cause: unknown) {
      if (abort.signal.aborted) return;
      if (request !== undefined) cancelAnimationFrame(request);
      previewRef.current = null;
      setError(cause instanceof Error ? cause.message : String(cause));
    }

    function draw() {
      if (!renderer || !asset || renderer.contextLost) return;
      const player = previewRef.current!.player;
      if (pixelRatio !== (window.devicePixelRatio || 1)) resize();
      renderer.beginFrame({width, height, clearColor: [0, 0, 0, 0]});
      try {
        renderer.draw(asset, player, {
          x: Math.floor(width / 2), y: Math.floor(height / 2),
          originX: asset.definition.width / 2, originY: asset.definition.height / 2,
          scaleX: zoomRef.current, scaleY: zoomRef.current,
        });
      } finally {
        renderer.endFrame();
      }
      const snapshot = player.snapshot();
      setPlayback(previous => previous?.frame === snapshot.frame &&
        previous.key === snapshot.key && previous.status === snapshot.status ? previous : snapshot);
    }

    function tick(time: number) {
      if (abort.signal.aborted) return;
      try {
        if (document.hidden || renderer?.contextLost) {
          resetClock();
        } else {
          if (previousTime !== undefined) {
            const elapsed = Math.max(0, time - previousTime) + fraction;
            const whole = Math.floor(elapsed);
            fraction = elapsed - whole;
            previewRef.current!.player.advance(whole);
          }
          previousTime = time;
          draw();
        }
        request = requestAnimationFrame(tick);
      } catch (cause) {
        fail(cause);
      }
    }

    function contextLost(event: Event) {
      event.preventDefault();
      resetClock();
      setRestoring(true);
    }

    function contextRestored() {
      if (!asset || !previewRef.current) {
        setAttempt(value => value + 1);
        return;
      }
      try {
        renderer!.restore();
        resetClock();
        setRestoring(false);
      } catch (cause) {
        fail(cause);
      }
    }

    canvas.addEventListener('webglcontextlost', contextLost);
    canvas.addEventListener('webglcontextrestored', contextRestored);
    document.addEventListener('visibilitychange', resetClock);
    window.addEventListener('resize', resize);
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    resize();

    async function load() {
      const gl = canvas.getContext('webgl2', {alpha: true, premultipliedAlpha: true});
      if (!gl) throw new Error('WebGL 2 is unavailable. Enable hardware acceleration and retry.');
      renderer = new WebGLSpriteRenderer(gl);
      const url = resolveSpriteUrl(sprite.filepath, document.baseURI);
      const options: WebGLLoadOptions = {signal: abort.signal};
      if (sprite.crustacean_json !== null) {
        const json = typeof sprite.crustacean_json === 'string'
          ? sprite.crustacean_json : JSON.stringify(sprite.crustacean_json);
        options.fetch = (input, init) => String(input) === url
          ? Promise.resolve(new Response(json)) : fetch(input, init);
      }
      if (sprite.crustacean_image) {
        options.resolveImage = (_reference, definitionUrl) =>
          resolveSpriteUrl(sprite.crustacean_image, definitionUrl);
      }
      const loaded = await renderer.loadSprite(url, options);
      if (abort.signal.aborted) {
        loaded.dispose();
        return;
      }
      asset = loaded;
      const keys = Object.keys(asset.definition.animations);
      const player = new SpritePlayer(asset.definition, {animation: sprite.animation ?? keys[0]});
      previewRef.current = {player, resetClock, draw};
      setAnimations(keys);
      draw();
      request = requestAnimationFrame(tick);
    }
    void load().catch(fail);

    return () => {
      abort.abort();
      if (request !== undefined) cancelAnimationFrame(request);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', resetClock);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', contextRestored);
      previewRef.current = null;
      asset?.dispose();
      renderer?.dispose();
    };
  }, [sprite.filepath, sprite.crustacean_json, sprite.crustacean_image, sprite.animation, attempt]);

  function changePlayer(action: (player: SpritePlayer) => void) {
    const preview = previewRef.current;
    if (!preview) return;
    action(preview.player);
    preview.resetClock();
    preview.draw();
  }

  return (
    <section id={sprite.info.id} className={css.container} aria-label={`${sprite.info.title} sprite preview`}>
      <div className={css.controls}>
        <label>
          Animation
          <select aria-label="Animation" value={playback?.key ?? ''} disabled={!playback || !!error || restoring}
            onChange={event => changePlayer(player => player.select(event.target.value))}>
            {!playback && <option value="">Loading…</option>}
            {animations.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <button type="button" disabled={!playback || !!error || restoring || playback.status === 'finished'}
          onClick={() => changePlayer(player => player.snapshot().status === 'paused' ? player.resume() : player.pause())}>
          {playback?.status === 'paused' ? 'Resume' : 'Pause'}
        </button>
        <button type="button" disabled={!playback || !!error || restoring}
          onClick={() => changePlayer(player => player.restart())}>Restart animation</button>
        <label>
          Zoom
          <select aria-label="Zoom" value={zoom} onChange={event => {
            zoomRef.current = Number(event.target.value);
            setZoom(zoomRef.current);
          }}>
            {[1, 2, 4, 8, 16].map(value => <option key={value} value={value}>{value * 100}%</option>)}
          </select>
        </label>
      </div>
      <div ref={viewportRef} className={css.viewport}>
        <canvas ref={canvasRef} className={css.canvas} aria-label={`${sprite.info.title} sprite`} />
        {error ? <div className={css.message} role="alert">
          <span>Could not render sprite: {error}</span>
          <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button>
        </div> : (restoring || !playback) && <div className={css.message} role="status">
          {restoring ? 'Restoring graphics…' : 'Loading sprite…'}
        </div>}
      </div>
      <div className={css.status}>
        {playback ? `Frame ${playback.frame} · ${playback.status}` : sprite.info.title}
      </div>
    </section>
  );
}
