import {createReducer, GenericAction, GenericState} from './reducer.inc';
import {toolsReducer} from './reducers/tools.reducer';

const breaditorReducer = function (state: GenericState, action: GenericAction) {
  return {
    tools: toolsReducer(state && state.tools, action),
    // documents: documentsReducer(state && state.documents, action, ...rest),
    // nestedState: nestedReducer(state && nestedState, action, ...rest),
  };
};

// function nestedReducer(state, action) {
//   return {
//     workspace: workspaceReducer(state && state.workspace, action, ...rest),
//     widgets: widgetsReducer(state && state.widgets, action, ...rest),
//   };
// }

const getInitialState = function () {
  return breaditorReducer({}, {action: 'INITIALIZE_STATE'});
};

export {breaditorReducer, getInitialState, createReducer};
