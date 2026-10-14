import {
  toolsReducer,
  initialToolState,
  /*Reducer /*GenericAction, Reducer*/
} from './tools.reducer';

test('toolsReducer INC_A', () => {
  const result = toolsReducer(initialToolState, {type: 'INC_A', foo: 2});

  expect(result.a).toBe(2);
});

test('toolsReducer INC_A', () => {
  const result = toolsReducer(initialToolState, {type: 'INC_B', bar: 7});

  expect(result.b).toBe(7);
});
