import {createReducer, GenericAction, GenericState} from './reducer.inc';
import {appReducer} from './reducers/app.reducer';
import {toolsReducer} from './reducers/tools.reducer';
import {fileMenuReducer} from './reducers/filemenu.reducer';

const breaditorReducer = function (state: GenericState, action: GenericAction) {
  console.log('breaditorReducer!');
  console.log(action, state);

  const newState = {
    app: appReducer(state && state.app, action),
    topmenu: fileMenuReducer(state && state.topmenu, action),
    tools: toolsReducer(state && state.tools, action),
    // documents: documentsReducer(state && state.documents, action, ...rest),
    // nestedState: nestedReducer(state && nestedState, action, ...rest),
  };

  console.log(newState);

  return newState;
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
