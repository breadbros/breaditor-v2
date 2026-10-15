import {DocumentInfo} from '../../../../types/global';

interface TextDocument {
  info: DocumentInfo;

  filepath: string;
  name: string;
  data?: string;

  encoding: string;
}

function textMaker(title: string, filepath = ''): TextDocument {
  return {
    info: {
      id: '',
      title,
      type: 'TEXT',
    },

    filepath,
    name: title,
    encoding: 'utf-8',
  };
}

export type {TextDocument};
export {textMaker};
