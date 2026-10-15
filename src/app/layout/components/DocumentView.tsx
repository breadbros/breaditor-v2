import React from 'react';
import {getDocumentById} from '../../breaditor/DocumentManager';
import {SpriteDocumentView} from '../../breaditor/documents/SpriteDocumentView';
import {TextDocumentView} from '../../breaditor/documents/TextDocumentView';
import {MapDocumentView} from '../../breaditor/documents/MapDocumentView';
import {isMapDocument} from '../../breaditor/documents/MapDocument';
import {Widget, WidgetProps} from './Widget';

export function DocumentView({id, title}: WidgetProps) {
  const document = getDocumentById(id);
  if (isMapDocument(document)) {
    return <MapDocumentView key={id} document={document} />;
  }
  if (document?.info.type === 'SPRITE' && 'crustacean_json' in document) {
    return <SpriteDocumentView key={id} document={document} />;
  }
  if (document?.info.type === 'TEXT' && 'encoding' in document) {
    return <TextDocumentView key={id} document={document} />;
  }
  return <Widget id={id} title={title} />;
}
