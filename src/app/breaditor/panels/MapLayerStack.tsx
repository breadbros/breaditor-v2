import React, {useRef, useState} from 'react';
import type {MapPanelProps} from './MapPanels';
import {mapRenderStack, moveMapRenderPass} from '../documents/mapRenderStack';
import Eye from '../../ui/icons/Eye';
// @ts-ignore
import css from './MapPanels.module.css';

type Props = Pick<MapPanelProps, 'asset' | 'selectedLayer' | 'onSelectLayer' | 'onEdit' | 'view' | 'onViewChange'>;

function Visibility({visible, label, disabled = false, entities = false, onClick}: {
  visible: boolean; label: string; disabled?: boolean; entities?: boolean; onClick: () => void;
}) {
  return <button type="button" className={`${css.layerEye} ${visible ? '' : css.layerEyeClosed}`} disabled={disabled}
    aria-label={label} title={label} aria-pressed={visible} onClick={onClick}>
    <Eye style={{width: 17, height: 17, fill: 'currentColor', display: 'block'}} />
    {entities && <span className={css.entityEyeMark} aria-hidden="true">E</span>}
  </button>;
}

export function MapLayerStack({asset, selectedLayer, onSelectLayer, onEdit, view, onViewChange}: Props) {
  const passes = mapRenderStack(asset), [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragged = useRef<{index: number; asset: Props['asset']; order: string} | null>(null);
  const entitiesVisible = view?.showEntities ?? asset.map.MAPED_ENTLAYER_VISIBLE ?? true;
  const obstructionsVisible = view?.showObstructions ?? asset.map.MAPED_OBSLAYER_VISIBLE ?? false;
  const zonesVisible = view?.showZones ?? false;
  const move = (from: number, to: number) => onEdit('Change layer render order', draft => moveMapRenderPass(draft, from, to));
  const layerVisibility = (index: number) => onEdit('Layer visibility', draft => {
    draft.map.layers[index].MAPED_HIDDEN = !draft.map.layers[index].MAPED_HIDDEN;
  });
  const entityVisibility = (index: number) => onEdit('Layer entity visibility', draft => {
    draft.map.layers[index].maped_HIDE_ENTS = !draft.map.layers[index].maped_HIDE_ENTS;
  });
  const clearDrag = () => {dragged.current = null; setDropIndex(null);};
  const validDrag = () => dragged.current?.asset === asset && dragged.current.order === asset.map.renderstring;
  const present = new Set(passes.flatMap(pass => pass.layerIndex === undefined ? [] : [pass.layerIndex]));
  const occurrences = new Map<string, number>();

  function artContent(index: number) {
    const layer = asset.map.layers[index], tall = asset.map.tallentitylayer === layer.name || (asset.map.tallentitylayer as unknown) === index;
    return <>
      <Visibility visible={!layer.MAPED_HIDDEN} label={`${layer.MAPED_HIDDEN ? 'Show' : 'Hide'} ${layer.name} layer`} onClick={() => layerVisibility(index)} />
      <Visibility entities visible={!layer.maped_HIDE_ENTS} disabled={!!layer.MAPED_HIDDEN || !entitiesVisible}
        label={`${layer.maped_HIDE_ENTS ? 'Show' : 'Hide'} entities on ${layer.name}`} onClick={() => entityVisibility(index)} />
      <button type="button" role="option" className={css.layerName} aria-selected={selectedLayer === String(index)}
        onClick={() => onSelectLayer(String(index))} title={layer.name}>
        <span className={css.layerNameText}>{index + 1}. {layer.name}</span>
        {tall && <span className={css.layerBadge} title="Tall entities redraw on this layer" aria-label="Tall entities redraw on this layer">Tall</span>}
        <small className={css.layerMeta}>{Math.round(layer.alpha * 100)}% · {layer.parallax.X}:{layer.parallax.Y}</small>
      </button>
    </>;
  }

  function entityContent(omitted = false) {
    return <>
      <Visibility visible={entitiesVisible} label={`${entitiesVisible ? 'Hide' : 'Show'} all entities`} disabled={!onViewChange}
        onClick={() => onViewChange?.({showEntities: !entitiesVisible})} />
      <span className={css.layerControlSpacer} />
      <button type="button" role="option" className={css.layerName} aria-selected={selectedLayer === 'E'} onClick={() => onSelectLayer('E')}>
        Entities <small className={css.layerMeta}>{omitted ? 'Not in render order' : 'Default entity pass (E)'}</small>
      </button>
    </>;
  }

  return <>
    <div className={css.layerOverlays} role="listbox" aria-label="Map overlays">
      <div className={css.layerOverlayRow} role="presentation">
        <Visibility visible={zonesVisible} label={`${zonesVisible ? 'Hide' : 'Show'} zones`} disabled={!onViewChange}
          onClick={() => onViewChange?.({showZones: !zonesVisible})} />
        <button type="button" role="option" aria-selected={selectedLayer === 'Z'} onClick={() => onSelectLayer('Z')}>Zones</button>
      </div>
      <div className={css.layerOverlayRow} role="presentation">
        <Visibility visible={obstructionsVisible} label={`${obstructionsVisible ? 'Hide' : 'Show'} obstruction overlay`} disabled={!onViewChange}
          onClick={() => onViewChange?.({showObstructions: !obstructionsVisible})} />
        {asset.map.format_version === 2 ? <span>Obstruction overlay</span> :
          <button type="button" role="option" aria-selected={selectedLayer === 'O:legacy'} onClick={() => onSelectLayer('O:legacy')}>Obstructions</button>}
      </div>
      {asset.map.format_version === 2 && (asset.map.obstruction_layers ?? []).map(layer => <div key={layer.id} className={`${css.layerOverlayRow} ${css.layerOverlayChild}`} role="presentation">
        <Visibility visible={!layer.MAPED_HIDDEN} disabled={!obstructionsVisible} label={`${layer.MAPED_HIDDEN ? 'Show' : 'Hide'} ${layer.name} obstruction layer`}
          onClick={() => onEdit('Obstruction visibility', draft => {const target = draft.map.obstruction_layers!.find(item => item.id === layer.id)!; target.MAPED_HIDDEN = !target.MAPED_HIDDEN;})} />
        <button type="button" role="option" aria-selected={selectedLayer === `O:${layer.id}`} onClick={() => onSelectLayer(`O:${layer.id}`)}>{layer.name}</button>
      </div>)}
    </div>
    <p className={css.layerHint}>Front to back · drag to change draw order</p>
    <div className={css.layerStack} role="listbox" aria-label="Map layers">
      {passes.map((pass, position) => {
        const occurrence = occurrences.get(pass.token) ?? 0;
        occurrences.set(pass.token, occurrence + 1);
        const layer = pass.layerIndex === undefined ? undefined : asset.map.layers[pass.layerIndex];
        const name = layer?.name ?? (pass.token === 'E' ? 'Entities' : pass.token === 'R' ? 'Custom render hook (R)' : pass.token === 'O' ? 'Obstruction pass (O)' : `Render pass ${pass.token}`);
        return <div key={`${pass.token}:${occurrence}`} role="presentation" className={`${css.layerRow} ${dropIndex === pass.renderIndex ? css.layerDrop : ''}`}
          data-render-index={pass.renderIndex} data-render-token={pass.token} data-layer-name={name} draggable
          onDragStart={event => {dragged.current = {index: pass.renderIndex, asset, order: asset.map.renderstring}; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', pass.token);}}
          onDragOver={event => {if (validDrag()) {event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropIndex(pass.renderIndex);}}}
          onDrop={event => {event.preventDefault(); if (validDrag() && dragged.current!.index !== pass.renderIndex) move(dragged.current!.index, pass.renderIndex); clearDrag();}}
          onDragEnd={clearDrag}>
          <span className={css.layerGrip} aria-hidden="true" title="Drag to change draw order">⠿</span>
          {layer ? artContent(pass.layerIndex!) : pass.token === 'E' ? entityContent() : <>
            <span className={css.layerControlSpacer} /><span className={css.layerControlSpacer} />
            <span className={css.layerName} title={pass.token === 'R' ? 'Custom render hook; scripts do not execute in the editor' : 'Preserved render pass'}>
              {name}<small className={css.layerMeta}>{pass.token === 'R' ? 'Scripts do not execute here' : 'Preserved render marker'}</small>
            </span>
          </>}
          <div className={css.layerMove}>
            <button type="button" aria-label={`Move ${name} up`} title="Move toward foreground" disabled={position === 0}
              onClick={() => move(pass.renderIndex, passes[position - 1].renderIndex)}>↑</button>
            <button type="button" aria-label={`Move ${name} down`} title="Move toward background" disabled={position === passes.length - 1}
              onClick={() => move(pass.renderIndex, passes[position + 1].renderIndex)}>↓</button>
          </div>
        </div>;
      })}
      {(!passes.some(pass => pass.token === 'E') || present.size < asset.map.layers.length) && <>
        <p className={css.layerHint}>Outside render order</p>
        {!passes.some(pass => pass.token === 'E') && <div className={css.layerRow} role="presentation"><span />{entityContent(true)}</div>}
        {asset.map.layers.map((_, index) => !present.has(index) && <div key={`omitted:${index}`} role="presentation" className={css.layerRow}>
          <span />{artContent(index)}<span className={css.layerMeta} title="Not in render order">—</span>
          <small className={css.layerOmitted}>Not in render order</small>
        </div>)}
      </>}
    </div>
  </>;
}
