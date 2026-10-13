import {
  appReducer,
  initialAppState,
  /*Reducer /*GenericAction, Reducer*/
} from './app.reducer';

jest.mock('../../../ReactDockableApp', () => {
  throw new Error('The app reducer must not load the UI');
});

test('appReducer isLoading on', () => {
  const result = appReducer(initialAppState, {
    type: 'SET_IS_LOADING',
    newState: true,
  });

  expect(result.isLoading).toBe(true);
});

test('appReducer isLoading off', () => {
  const result = appReducer(initialAppState, {
    type: 'SET_IS_LOADING',
    newState: true,
  });

  expect(result.isLoading).toBe(true);

  const result2 = appReducer(result, {
    type: 'SET_IS_LOADING',
    newState: false,
  });

  expect(result2.isLoading).toBe(false);
});

test('panel toggles update state without mutating the input or loading the UI', () => {
  const state = Object.freeze({...initialAppState, isLoading: true});
  const on = appReducer(state, {type: 'TEST_PANELS_ON', isOn: true});
  const off = appReducer(on, {type: 'TEST_PANELS_ON', isOn: false});

  expect(on).toEqual({...state, isPanelsOn: true});
  expect(off).toEqual({...state, isPanelsOn: false});
  expect(state).toEqual({...initialAppState, isLoading: true});
  expect(on.isPanelsOn).toBe(true);
});
