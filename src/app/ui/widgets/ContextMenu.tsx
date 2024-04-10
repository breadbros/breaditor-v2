import React, {useEffect, useState, RefObject} from 'react';
// @ts-ignore
import css from './ContextMenu.module.css';
import {Vec2xy} from '../../../../types/global';

interface ContextMenuProps {
  offset?: Vec2xy;
  left: number;
  top: number;
  actions?: any;
  onClickOut: () => void;
  testId?: string;
}

const handleClickOut = (props: ContextMenuProps) => {
  props.onClickOut();
};

const handleAction = (action: any, props: ContextMenuProps) => {
  action();
  props.onClickOut();
};

const handleSelection = (callback: any, i: number, props: ContextMenuProps) => {
  callback(i);
  props.onClickOut();
};

/*
const handleBool = (toggleFunction: () => void, props: ContextMenuProps) => {
  toggleFunction();
  props.onClickOut();
};
*/

const ContextMenu: React.FC<ContextMenuProps> = (props) => {
  let containerRef: RefObject<HTMLDivElement> = React.createRef();
  const [state, setState] = useState<ContextMenuProps>({
    offset: {
      x: 0,
      y: 0,
    },
    left: 0,
    top: 0,
    onClickOut: () => {
      console.error('onClickout undefined?');
    },
  });
  useEffect(() => {
    // Code to run on component mount
    if (containerRef.current) {
      let x = 0,
        y = 0;
      // @ts-ignore
      let menuBox = containerRef.current.getBoundingClientRect();
      let viewPort = {width: window.innerWidth, height: window.innerHeight};

      if (props.left + menuBox.width > viewPort.width) {
        x -= props.left + menuBox.width - viewPort.width;
      }
      if (props.top + menuBox.height > viewPort.height) {
        y -= props.top + menuBox.height - viewPort.height;
      }

      setState((prevState) => ({
        ...prevState,
        offset: {x, y},
      }));
    }

    // Optional cleanup function to run on unmount
    // return () => {
    //  console.log('ContextMenu Component unmounted');
    //};
  }, []); // Empty dependency array to only run once

  const testIdAttribute = props.testId ? {'data-testid': props.testId} : {};

  return (
    <div
      className={css.container}
      onClick={() => {
        handleClickOut(props);
      }}
    >
      <div
        style={{
          left: props.left + (state.offset ? state.offset.x : 0),
          top: props.top + (state.offset ? state.offset.y : 0),
        }}
        className={css.contextMenu}
        ref={containerRef}
        {...testIdAttribute}
      >
        {props.actions.map((actionGroup: any, i: number, arr: any[]) => {
          switch (actionGroup.type) {
            case 'actions':
              return (
                <React.Fragment key={i}>
                  {Object.keys(actionGroup.actions).map((action, a) => (
                    <div
                      key={a}
                      className={css.contextMenuItem}
                      onClick={() => {
                        handleAction(actionGroup.actions[action], props);
                      }}
                    >
                      <div>{action}</div>
                      <div style={{marginLeft: 16, color: '#666'}}>Ctrl+Z</div>
                    </div>
                  ))}
                  {i !== arr.length - 1 ? (
                    <div className={css.contextMenuDivider} />
                  ) : null}
                </React.Fragment>
              );
            case 'enum':
              return (
                <React.Fragment key={i}>
                  {actionGroup.options.map((action: any, a: number) => (
                    <div
                      key={a}
                      className={css.contextMenuItem}
                      onClick={() => {
                        handleSelection(actionGroup.onChange, a, props);
                      }}
                    >
                      <div className={css.radio}>
                        {actionGroup.selected === a ? '⚫' : '⚪'}
                      </div>
                      <span>{action}</span>
                    </div>
                  ))}
                  {i !== arr.length - 1 ? (
                    <div className={css.contextMenuDivider} />
                  ) : null}
                </React.Fragment>
              );
            case 'bools':
              return (
                <React.Fragment key={i}>
                  {Object.keys(actionGroup.options).map(
                    (option: any, a: any) => (
                      <div
                        key={a}
                        className={css.contextMenuItem}
                        onClick={() => {
                          handleAction(
                            actionGroup.options[option].function,
                            props,
                          );
                        }}
                      >
                        <div className={css.checkbox}>
                          {actionGroup.options[option].value === true
                            ? '✔'
                            : ' '}
                        </div>
                        <span>{option}</span>
                      </div>
                    ),
                  )}
                  {i !== arr.length - 1 ? (
                    <div className={css.contextMenuDivider} />
                  ) : null}
                </React.Fragment>
              );
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
};

export {ContextMenu};
