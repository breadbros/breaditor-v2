import {applyMiddleware, createStore, Store} from 'redux';
import {composeWithDevTools} from 'redux-devtools-extension';

import {rootReducer, RootState} from '../reducers';

const configureStore = (
  initialState?: RootState,
): Store<RootState | undefined> => {
  const middlewares: any[] = [];
  const enhancer = composeWithDevTools(applyMiddleware(...middlewares));
  return createStore(rootReducer, initialState, enhancer);
};

const store = configureStore();

// @ts-ignore
if (typeof module.hot !== 'undefined') {
  // @ts-ignore
  module.hot.accept('../reducers', () =>
    store.replaceReducer(require('../reducers').rootReducer),
  );
}

export default store;
