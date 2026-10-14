import React from 'react';
import {activeDocument} from '../../breaditor/DocumentManager';
import {SpriteInfoPanel} from '../../breaditor/panels/SpriteInfoPanel';
import {Widget, WidgetProps} from './Widget';

export function PanelView({id, title}: WidgetProps) {
  const document = activeDocument();
  if (id === 'PanelInfo' && document?.info.type === 'SPRITE' && 'crustacean_json' in document) {
    return <SpriteInfoPanel key={document.info.id} document={document} />;
  }
  return <Widget id={id} title={title} />;
}
