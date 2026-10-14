/** @jest-environment jsdom */
import {fileMenuReducer, initialFileMenuState} from './filemenu.reducer';

const openFileDialog = jest.fn();
const thunkDispatch = jest.fn();

beforeEach(() => {
  openFileDialog.mockReset();
  thunkDispatch.mockReset();
  (window as any).electronAPI = {openFileDialog};
  jest.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

test('opening a document enables loading before requesting the native dialog', () => {
  const state = Object.freeze({...initialFileMenuState});
  openFileDialog.mockImplementation(() => {
    expect(thunkDispatch).toHaveBeenCalledWith({type: 'SET_IS_LOADING', newState: true});
  });

  const result = fileMenuReducer(state, {type: 'DOC_OPEN_EXISTING', thunkDispatch});

  expect(openFileDialog).toHaveBeenCalledWith({properties: ['openFile']});
  expect(thunkDispatch).toHaveBeenCalledTimes(1);
  expect(result).toEqual(state);
});

test('a selected file clears loading and reports the selected path', () => {
  const result = fileMenuReducer(initialFileMenuState, {
    type: 'DOC_OPEN_FILE_FOUND', filePath: '/maps/example.txt', thunkDispatch,
  });

  expect(thunkDispatch).toHaveBeenCalledWith({type: 'SET_IS_LOADING', newState: false});
  expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('/maps/example.txt'));
  expect(openFileDialog).not.toHaveBeenCalled();
  expect(result).toEqual(initialFileMenuState);
});

test('dialog failures clear loading and report the error', () => {
  fileMenuReducer(initialFileMenuState, {
    type: 'DOC_OPEN_FILE_FAILURE', error: 'Permission denied', thunkDispatch,
  });

  expect(thunkDispatch).toHaveBeenCalledWith({type: 'SET_IS_LOADING', newState: false});
  expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Permission denied'));
  expect(openFileDialog).not.toHaveBeenCalled();
});

test('unrelated actions preserve state without invoking native APIs', () => {
  expect(fileMenuReducer(initialFileMenuState, {type: 'DOC_FOCUS'} as any))
    .toBe(initialFileMenuState);
  expect(thunkDispatch).not.toHaveBeenCalled();
  expect(openFileDialog).not.toHaveBeenCalled();
  expect(window.alert).not.toHaveBeenCalled();
});

test('canceling the dialog clears loading without displaying an error', () => {
  fileMenuReducer(initialFileMenuState, {type: 'DOC_OPEN_FILE_CANCELLED', thunkDispatch});
  expect(thunkDispatch).toHaveBeenCalledWith({type: 'SET_IS_LOADING', newState: false});
  expect(window.alert).not.toHaveBeenCalled();
  expect(openFileDialog).not.toHaveBeenCalled();
});
