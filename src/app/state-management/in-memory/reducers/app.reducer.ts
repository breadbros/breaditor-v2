import {
  createReducer,
  Reducer /*GenericAction, Reducer*/,
} from '../reducer.inc';

interface AppState {
  isLoading: boolean; // display the clickshield?
}

interface SetIsLoadingAction {
  newState: boolean;
  type: 'SET_IS_LOADING';
}

type AppAction = SetIsLoadingAction;

const initialAppState: AppState = {
  isLoading: false,
};

const appReducer: Reducer<AppState, AppAction> = createReducer(
  initialAppState,
  {
    SET_IS_LOADING: (state, action: SetIsLoadingAction) => {
      return {...state, isLoading: action.newState};
    },
  },
);

export {initialAppState, appReducer};
