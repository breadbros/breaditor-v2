import React from 'react';
import {getDocumentById} from '../../breaditor/DocumentManager';
import {SpriteDocumentView} from '../../breaditor/documents/SpriteDocumentView';
import {Widget, WidgetProps} from './Widget';

export function DocumentView({id, title}: WidgetProps) {
  const document = getDocumentById(id);
  if (document?.info.type === 'SPRITE' && 'crustacean_json' in document) {
    return <SpriteDocumentView key={id} document={document} />;
  }
  return <Widget id={id} title={title} />;
}
