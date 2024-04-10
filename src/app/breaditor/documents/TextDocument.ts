import {DocumentInfo} from '../../../../types/global';

interface TextDocument {
  info: DocumentInfo;

  filepath: string;
  name: string;
  data: any;

  encoding: string;
}

function textMaker(title: string): TextDocument {
  return {
    info: {
      id: '',
      title,
      type: 'TEXT',
    },

    filepath: 'a_fake_file.txt',
    name: title,
    data: {},
    encoding: 'LOL',
  };
}

export type {TextDocument};
export {textMaker};
