import {
  createReducer,
  type ActionsForReducer,
  type GenericState,
  type BreaditorInitializeAction,
} from '../../../shared/reducer/reducer.inc';

import {fileReducer} from './reducers/file.reducer';

type GlobalActions =
  | BreaditorInitializeAction
  | ActionsForReducer<typeof fileReducer>;

type Dispatch<A> = (value: A) => void;
type BreaditorMainDispatchType = Dispatch<GlobalActions>;

export type {BreaditorMainDispatchType};
