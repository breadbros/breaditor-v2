import React, {useState} from 'react';
import {ReactNode} from 'react';

// @ts-ignore
import css from './PropertyBar.module.css';

interface StatusBarProps {
  initialStatuses: string[];
  dispatch: ({}: any) => void;
}

let _stateUpdate = (data: any) => {
  data = data;
  // console.warn(`StatusBar::_stateUpdate uninitialized, passed: `, data);
};

const StatusBar: React.FC<StatusBarProps> = (props) => {
  const [statuses, setState] = useState(props.initialStatuses);
  _stateUpdate = setState;

  return (
    <div className={css.container} data-testid="breaditor-browser-statusbar">
      {statuses.map((str: string, idx: number) => (
        <PropertyGroup key={idx}>{str}</PropertyGroup>
      ))}
    </div>
  );
};

function updateStatusBar(newStatuses: string[]) {
  //console.log('updateStatusBar', newStatuses);
  _stateUpdate(newStatuses);
}

interface PropertyGroupProps {
  children: ReactNode;
}
const PropertyGroup: React.FC<PropertyGroupProps> = (props) => {
  return (
    <div
      style={{
        // height: "100%",
        paddingLeft: 12,
        paddingRight: 12,
        display: 'flex',
        borderLeft: '1px solid rgba(40,40,40,0.75)',
        // padding: "10px 16px"
      }}
    >
      {props.children}
    </div>
  );
};

export {StatusBar, updateStatusBar};
