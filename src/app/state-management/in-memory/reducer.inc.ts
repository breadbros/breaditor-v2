type StringToAnyMap = {[key: string]: any};
type GenericState = StringToAnyMap;

type GenericAction = {
  [key: string]: any;
  type: string;
};

type ReducerMap<S extends GenericState, A extends GenericAction> = {
  [key: string]: (state: S, action: A) => S;
};

type Reducer<S, A> = (state: S, action: A) => S;

function createReducer<S extends GenericState, A extends GenericAction>(
  initialState: S,
  handlers: ReducerMap<S, A>,
): Reducer<S, A> {
  const myHandlers = handlers;

  return function (state: S = initialState, action: A): S {
    if (action && myHandlers.hasOwnProperty(action.type)) {
      return myHandlers[action.type](state, action);
    } else {
      // console.error(`Unhandled action: ${action.type} `);
    }
    return state;
  };
}

export type {StringToAnyMap, Reducer};
export {createReducer};
