import {
  createReducer,
  Reducer /*GenericAction, Reducer*/,
} from '../../../../shared/reducer/reducer.inc';

interface DocumentFocusAction {
  type: 'DOC_FOCUS';
  document_id: string;
}

export type DocumentsAction =
    | DocumentFocusAction;

export interface DocumentsState {
    activeDoc: string;
}

const initialDocumentsState: DocumentsState = {
    activeDoc: ""
};

const documentsReducer: Reducer<DocumentsState, DocumentsAction> = createReducer(
  initialDocumentsState,
  {
    DOC_FOCUS: (state, action: DocumentFocusAction) => {
      console.warn("this... does nothing?");
      return {...state, activeDoc: action.document_id };
    }
  },
);

export {initialDocumentsState, documentsReducer};
