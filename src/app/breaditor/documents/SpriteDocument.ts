import {DocumentInfo} from '../../../../types/global';

interface SpriteDocument {
  info: DocumentInfo;

  filepath: string;
  format: string;

  crustacean_json: {};
  crustacean_image: string;

  name: string;
  data: any;
}

function spriteMaker(title: string): SpriteDocument {
  return {
    info: {
      id: '',
      title,
      type: 'SPRITE',
    },

    filepath: 'a_path.map',
    format: 'VERY-FAKE-SPRITE',

    crustacean_json: {},
    crustacean_image: 'pretty.png',

    name: title,
    data: {},
  };
}
export type {SpriteDocument};
export {spriteMaker};
