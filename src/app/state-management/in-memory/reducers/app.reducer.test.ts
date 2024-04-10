import {
  appReducer,
  initialAppState,
  /*Reducer /*GenericAction, Reducer*/
} from './app.reducer';

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
