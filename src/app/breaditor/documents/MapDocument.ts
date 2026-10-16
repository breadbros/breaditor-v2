import {DocumentInfo} from '../../../../types/global';

interface MapDocument {
  info: DocumentInfo;

  filepath: string;
  name: string;
  data: any;

  format: string;
  contentRoot?: string;
  bundled?: boolean;
}

function mapMaker(title: string, filepath: string | number = '', contentRoot?: string | string[], bundled = false): MapDocument {
  return {
    info: {
      id: '',
      title,
      type: 'MAP',
    },

    filepath: typeof filepath === 'string' ? filepath : '',
    name: title,
    data: {},

    format: 'CRUSTACEAN-MAP',
    contentRoot: typeof contentRoot === 'string' ? contentRoot : undefined,
    bundled,
  };
}

export type {MapDocument};
function isMapDocument(doc: {info: DocumentInfo} | null | undefined): doc is MapDocument {
  return doc?.info.type === 'MAP';
}
export {mapMaker, isMapDocument};
