import {
  createReducer,
  type ActionsForReducer,
  type GenericState,
  type BreaditorInitializeAction,
} from '../../../shared/reducer/reducer.inc';
import {appReducer} from './reducers/app.reducer';
import {toolsReducer} from './reducers/tools.reducer';
import {fileMenuReducer} from './reducers/filemenu.reducer';

export type GlobalActions =
  | BreaditorInitializeAction
  | ActionsForReducer<typeof appReducer>
  | ActionsForReducer<typeof toolsReducer>
  | ActionsForReducer<typeof fileMenuReducer>;

type BreaditorAppDispatchType = React.Dispatch<GlobalActions>;

const breaditorAppReducer = function (
  state: GenericState,
  action: GlobalActions,
) {
  const newState = {
    app: appReducer(state && state.app, action as any),
    topmenu: fileMenuReducer(state && state.topmenu, action as any),
    tools: toolsReducer(state && state.tools, action as any),
    // documents: documentsReducer(state && state.documents, action, ...rest),
    // nestedState: nestedReducer(state && nestedState, action, ...rest),
  };

  return newState;
};

// function nestedReducer(state, action) {
//   return {
//     workspace: workspaceReducer(state && state.workspace, action, ...rest),
//     widgets: widgetsReducer(state && state.widgets, action, ...rest),
//   };
// }

const getInitialState = function () {
  return breaditorAppReducer({}, {type: 'INITIALIZE_STATE'});
};

export type {BreaditorAppDispatchType};

export {breaditorAppReducer, getInitialState, createReducer};
