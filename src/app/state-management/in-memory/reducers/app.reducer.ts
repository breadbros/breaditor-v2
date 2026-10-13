import {
  createReducer,
  Reducer /*GenericAction, Reducer*/,
} from '../../../../shared/reducer/reducer.inc';

interface AppState {
  isLoading: boolean; // display the clickshield?
  isPanelsOn?: boolean;
}

interface SetIsLoadingAction {
  newState: boolean;
  type: 'SET_IS_LOADING';
}

interface PanelTestAction {
  isOn: boolean;
  type: 'TEST_PANELS_ON';
}

type AppAction = SetIsLoadingAction | PanelTestAction;

const initialAppState: AppState = {
  isLoading: false,
};

const appReducer: Reducer<AppState, AppAction> = createReducer(
  initialAppState,
  {
    SET_IS_LOADING: (state, action: SetIsLoadingAction) => {
      return {...state, isLoading: action.newState};
    },
    TEST_PANELS_ON: (state, action: PanelTestAction) => {
      return {...state, isPanelsOn: action.isOn};
    },
  },
);

export {initialAppState, appReducer};
