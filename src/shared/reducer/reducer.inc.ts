import {type GlobalActions} from '../../app/state-management/in-memory/app_reducer';

type StringToAnyMap = {[key: string]: any};
// type GenericState = StringToAnyMap;
type GenericState = any;

// type GenericAction = {
//   [key: string]: any;
//   type: string;
// };
type GenericAction = any;

type GenericReducerMap = {
  [key: string]: (state: GenericState, action: GenericAction) => GenericState;
};

type Reducer<S, A> = (state: S, action: A) => S;
type GenericReducer = Reducer<GenericState, GenericAction>; //TODO: GenericReducer will die shortly.  But for now...

function createReducer(
  initialState: GenericState,
  handlers: GenericReducerMap,
): GenericReducer {
  const myHandlers = handlers;
  const myInitialState = initialState;

  return function (
    state: GenericState = myInitialState,
    action: GenericAction,
  ): GenericState {
    if (action && myHandlers.hasOwnProperty(action.type)) {
      const myReducer = myHandlers[action.type];
      return myReducer(state, action);
    } else {
      // console.error(`Unhandled action: ${action.type} `);
    }
    return state;
  };
}

interface BreaditorInitializeAction {
  type: 'INITIALIZE_STATE';
}

type ActionsForReducer<T extends Reducer<any, any>> = T extends Reducer<
  any,
  infer ActionsUnion
>
  ? ActionsUnion
  : never;

export type BreaditorDispatchType = React.Dispatch<GlobalActions>;

export type {
  StringToAnyMap,
  GenericState,
  GenericAction,
  GenericReducerMap,
  Reducer,
  GenericReducer,
  ActionsForReducer,
  BreaditorInitializeAction,
};
export {createReducer};