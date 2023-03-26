import React from 'react';
import reducer from './app_reducer.js';

class Store {
  state = reducer(null, {}); // initialize?
  observers: any[] = [];

  dispatch(action: any, ...rest: any[]) {
    // console.log({ action, ...rest });
    this.state = reducer(this.state, action, ...rest);
    this.observers.forEach((observer) => {
      // observer.setState(this.state);
      observer.forceUpdate();
    });
  }
}

const store = new Store();

export default store;

export const observer = (ComponentClass: any) => {
  return class extends React.Component {
    constructor(props: any) {
      super(props);
      store.observers.push(this);
    }

    render() {
      return (
        <ComponentClass
          state={store.state}
          dispatch={(action: any, ...rest: any[]) =>
            store.dispatch(action, ...rest)
          }
          {...ComponentClass.props}
          {...this.props}
        />
      );
    }
  };
};
