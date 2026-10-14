import {documentsReducer, initialDocumentsState} from './documents.reducer';

test('initializes with no focused document', () => {
  expect(documentsReducer(undefined as any, {type: 'INITIALIZE_STATE'} as any))
    .toEqual({activeDoc: ''});
});

test('focuses a document without mutating the previous state', () => {
  const state = Object.freeze({...initialDocumentsState, activeDoc: 'previous'});
  const focused = documentsReducer(state, {type: 'DOC_FOCUS', document_id: 'next'});

  expect(focused.activeDoc).toBe('next');
  expect(focused).not.toBe(state);
  expect(state.activeDoc).toBe('previous');
});

test('unrelated actions preserve the focused document and state identity', () => {
  const state = {activeDoc: 'document'};
  expect(documentsReducer(state, {type: 'SET_IS_LOADING', newState: true} as any))
    .toBe(state);
});
