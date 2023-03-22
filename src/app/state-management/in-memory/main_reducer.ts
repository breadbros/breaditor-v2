import {
  createReducer,
  // GenericAction,
  GenericState,
  type Reducer,
} from './reducer.inc';
import {appReducer} from './reducers/app.reducer';
import {toolsReducer} from './reducers/tools.reducer';
import {fileMenuReducer} from './reducers/filemenu.reducer';

type ActionsForReducer<T extends Reducer<any, any>> = T extends Reducer<
  any,
  infer ActionsUnion
>
  ? ActionsUnion
  : never;

interface BreaditorInitializeAction {
  type: 'INITIALIZE_STATE';
}

type GlobalActions =
  | BreaditorInitializeAction
  | ActionsForReducer<typeof appReducer>
  | ActionsForReducer<typeof toolsReducer>
  | ActionsForReducer<typeof fileMenuReducer>;

export type BreaditorDispatchType = React.Dispatch<GlobalActions>;

const breaditorReducer = function (state: GenericState, action: GlobalActions) {
  console.log('breaditorReducer!');
  console.log(action, state);

  const newState = {
    app: appReducer(state && state.app, action as any),
    topmenu: fileMenuReducer(state && state.topmenu, action as any),
    tools: toolsReducer(state && state.tools, action as any),
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
  return breaditorReducer({}, {type: 'INITIALIZE_STATE'});
};

export {breaditorReducer, getInitialState, createReducer};
