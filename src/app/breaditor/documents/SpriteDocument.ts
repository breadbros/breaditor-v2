import {DocumentInfo} from '../../../../types/global';
import type {CrustyV1} from 'crustacean-sprite-lib';

interface SpriteDocument {
  info: DocumentInfo;

  filepath: string;
  format: string;

  crustacean_json: CrustyV1 | string | null;
  crustacean_image: string;
  animation?: string;

  name: string;
  data: any;
}

function spriteMaker(title: string, filepath = 'assets/lord-stan/lord_stan.json'): SpriteDocument {
  return {
    info: {
      id: '',
      title,
      type: 'SPRITE',
    },

    filepath,
    format: 'CRUSTY-V1',

    crustacean_json: null,
    crustacean_image: '',
    animation: filepath === 'assets/lord-stan/lord_stan.json' ? 'valid_looping_1' : undefined,

    name: title,
    data: {},
  };
}
export type {SpriteDocument};
export {spriteMaker};
