import {
  createReducer,
  Reducer /*GenericAction, Reducer*/,
} from '../reducer.inc';

interface OpenDocumentAction {
  thunkDispatch: React.Dispatch<any>;
  type: 'DOC_OPEN_EXISTING';
}

interface OpenFileFoundAction {
  type: 'DOC_OPEN_FILE_FOUND';
  thunkDispatch: React.Dispatch<any>;
  filePath: string; //path?
}

interface OpenFileCancelledAction {
  type: 'DOC_OPEN_FILE_FAILURE';
  thunkDispatch: React.Dispatch<any>;
  error: any; //path?
}

type FileMenuAction =
  | OpenDocumentAction
  | OpenFileFoundAction
  | OpenFileCancelledAction;

interface FileMenuState {}
const initialFileMenuState: FileMenuState = {};

const fileMenuReducer: Reducer<FileMenuState, FileMenuAction> = createReducer(
  initialFileMenuState,
  {
    DOC_OPEN_FILE_FOUND: (state, action: OpenFileCancelledAction) => {
      action.thunkDispatch({type: 'SET_IS_LOADING', newState: false});
      return {...state};
    },
    DOC_OPEN_FILE_FAILURE: (state, action: OpenFileFoundAction) => {
      action.thunkDispatch({type: 'SET_IS_LOADING', newState: false});
      return {...state};
    },
    DOC_OPEN_EXISTING: (state, action: OpenDocumentAction) => {
      console.log('DOC_OPEN_EXISTING is called');

      const thunk = function (dispatch: React.Dispatch<any>) {
        console.log('THUNKING');
        dispatch({type: 'SET_IS_LOADING', newState: true});

        const options = {
          properties: ['openFile'],
        };

        console.log('INVOKING window.electronAPI.openFileDialog');
        // @ts-ignore
        window.electronAPI.openFileDialog(options);
        console.log('bueller?');

        /*
        dialog
          .showOpenDialog(options)
          .then((result: any) => {
            if (!result.canceled && result.filePaths.length > 0) {
              const filePath = result.filePaths[0];
              dispatch({
                type: 'OPEN_FILE_FOUND',
                payload: filePath,
                thunkDispatch: dispatch,
              });
            }
          })
          .catch((error: any) => {
            dispatch({
              type: 'OPEN_FILE_FAILURE',
              payload: error,
              thunkDispatch: dispatch,
            });
          });
      */
      };

      thunk(action.thunkDispatch);

      return {...state};
    },
  },
);

export {initialFileMenuState, fileMenuReducer};
