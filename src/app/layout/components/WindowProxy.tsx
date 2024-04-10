/*
import React from 'react';

class WindowProxy extends React.Component {
  componentDidMount() {
    for (const property in this.props.events) {
      window.addEventListener(property, this.props.events[property]);
    }
  }
  componentWillUnmount() {
    for (const property in this.props.events) {
      window.removeEventListener(property, this.props.events[property]);
    }
  }
  render() {
    return <>{this.props.children}</>;
  }
}
*/
import React, {useEffect} from 'react';

function WindowProxy(props: any) {
  useEffect(() => {
    const {events} = props;
    for (const property in events) {
      window.addEventListener(property, events[property]);
    }
    return () => {
      for (const property in events) {
        window.removeEventListener(property, events[property]);
      }
    };
  }, [props.events]);

  return <>{props.children}</>;
}

export {WindowProxy};
