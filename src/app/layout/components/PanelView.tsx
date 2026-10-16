import React from 'react';
import {activeDocument} from '../../breaditor/DocumentManager';
import {SpriteInfoPanel} from '../../breaditor/panels/SpriteInfoPanel';
import {MapDocumentPanel} from '../../breaditor/documents/MapDocumentView';
import {isMapDocument} from '../../breaditor/documents/MapDocument';
import {Widget, WidgetProps} from './Widget';

export function PanelView({id, title}: WidgetProps) {
  const document = activeDocument();
  if (isMapDocument(document)) {
    return <MapDocumentPanel key={`${document.info.id}:${id}`} document={document} panel={id.replace(/^Panel/, '')} id={id} title={title} />;
  }
  if (id === 'PanelInfo' && document?.info.type === 'SPRITE' && 'crustacean_json' in document) {
    return <SpriteInfoPanel key={document.info.id} document={document} />;
  }
  return <Widget id={id} title={title} />;
}
