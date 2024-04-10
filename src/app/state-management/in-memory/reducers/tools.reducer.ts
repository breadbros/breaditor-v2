import {
  createReducer,
  // GenericAction,
  Reducer /*, Reducer*/,
} from '../../../../shared/reducer/reducer.inc';

import {TOOLS} from '../../../breaditor/tools/constants'; //TODO: This should be in *THIS* file, right?
// TODO: and should have a concrete union type I think?

interface ToolState {
  activeTool: number; // Tool index, really
  tool: any; // how to type this?
  a: number;
  b: number;
}

interface ToolActionIncA {
  foo: number;
  type: 'INC_A';
}

interface ToolActionIncB {
  bar: number;
  type: 'INC_B';
}

type ToolAction = ToolActionIncA | ToolActionIncB;

const initialToolState: ToolState = {
  activeTool: TOOLS.Brush,
  tool: {},
  a: 0,
  b: 0,
};

const toolsReducer: Reducer<ToolState, ToolAction> = createReducer(
  initialToolState,
  {
    INC_A: (state, action: ToolActionIncA) => {
      return {...state, a: state.a + action.foo};
    },
    INC_B: (state, action: ToolActionIncB) => {
      return {...state, b: state.b + action.bar};
    },
  },
);

// type ActionsForReducer<T extends Reducer<any, any>> = T extends Reducer<
//   any,
//   infer ActionsUnion
// >
//   ? ActionsUnion
//   : never;

// type Test = ActionsForReducer<typeof toolsReducer>;

export {initialToolState, toolsReducer};
