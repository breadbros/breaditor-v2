import {createReducer} from './reducer.inc';
import {toolsReducer} from './reducers/tools.reducer';

//import documentsReducer from './reducers/documents.reducer.js';
//import workspaceReducer from './reducers/workspace.reducer.js';

//import widgetsReducer from './reducers/widgets.reducer.js';

const breaditorReducer = createReducer(
  {},
  {
    foo: createReducer(
      {},
      {
        FOO_ACTION: (state: any, action: any) => {
          return {...state, a: state.a + action.foo};
        },
      },
    ),
    //tools: toolsReducer,
  },
);

const taco = function () {
  toolsReducer;
};

const getInitialState = function () {
  return breaditorReducer({}, {action: 'INITIALIZE_STATE'});
};

export {breaditorReducer, getInitialState, createReducer, taco};
