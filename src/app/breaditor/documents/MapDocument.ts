import {DocumentInfo} from '../../../../types/global';

interface MapDocument {
  info: DocumentInfo;

  filepath: string;
  name: string;
  data: any;

  format: string;

  crustacean_bulk_data: {};
  crustacean_user_data: {};
  crustacean_image: string;
}

function mapMaker(title: string): MapDocument {
  return {
    info: {
      id: '',
      title,
      type: 'MAP',
    },

    filepath: 'a_path.map',
    name: title,
    data: {},

    format: 'VERY-FAKE',

    crustacean_bulk_data: {},
    crustacean_user_data: {},
    crustacean_image: 'pretty.png',
  };
}

export type {MapDocument};
export {mapMaker};
