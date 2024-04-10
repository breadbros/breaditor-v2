import {
  createReducer,
  Reducer /*GenericAction, Reducer*/,
} from '../../../../shared/reducer/reducer.inc';

interface IdentifyDocumentAction {
  thunkDispatch: React.Dispatch<any>;
  type: 'DOC_IDENTIFY';
}

type FileAction = /*|*/ IdentifyDocumentAction;
interface FileState {}

const initialFileState: FileState = {};

const fileReducer: Reducer<FileState, FileAction> = createReducer(
  initialFileState,
  {
    DOC_IDENTIFY: (state, action: IdentifyDocumentAction) => {
      console.log(action);
      return {...state};
    },
  },
);

export {initialFileState, fileReducer};
