import React, {useState, MouseEvent, useEffect, useRef} from 'react';
import {ContextMenu} from '../../ui/widgets/ContextMenu';
import isElectron from 'is-electron';

import {WidgetInfo, Vec2xy} from '../../../../types/global';

// @ts-ignore
import css from './MenuBar.module.css';

interface MenuBarProps {
  dispatch: ({}: any) => void;
  widgets: WidgetInfo[];
  hidden: any;
  getMenu: (dispatch: ({}: any) => void) => any;
}

interface SelectableMenuItemState {
  selected: number | null;
  contextPos: Vec2xy;
}

const MenuBar: React.FC<MenuBarProps> = (props) => {
  const initialState: SelectableMenuItemState = {
    selected: null,
    contextPos: {x: 0, y: 0},
  };

  const [state, setState] = useState<SelectableMenuItemState>(initialState);
  const {dispatch} = props;

  let handleMouseDown = function (e: any, idx: number) {
    e.stopPropagation();
    let box = e.target.getBoundingClientRect();
    if (state.selected === null) {
      setState({
        selected: idx,
        contextPos: {x: box.x, y: box.y + box.height},
      });
    } else {
      setState((prevState) => ({
        ...prevState,
        selected: null,
      }));
    }
  };

  let handleMenuSelect = function (e: any, idx: number) {
    let box = e.target.getBoundingClientRect();
    if (state.selected !== null)
      setState({
        selected: idx,
        contextPos: {x: box.x, y: box.y + box.height},
      });
  };

  function renderTitle(draw = true) {
    return (
      draw && (
        <>
          Index Painter{' '}
          <span style={{marginLeft: 8, marginTop: 2, fontSize: 11}}>
            Alpha v0.0.1
          </span>
        </>
      )
    );
  }

  const elementRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (elementRef != null && elementRef.current != null) {
      // code to execute after the layout has updated
      const width = elementRef.current.offsetWidth;

      const root = document.documentElement;
      root.style.setProperty(
        '--topmenu-container-width',
        `${elementRef.current.clientWidth}px`,
      );

      console.log(`Element width is ${width}px`);
    } else {
      console.error(
        `Could not set --topmenu-container-width.  elementRef was inexplicably null.`,
      );
    }
  }, []);

  return (
    <div className={css.container} data-testid="breaditor-browser-menubar">
      {/* Menu Items */}
      <div className={css.menu} ref={elementRef} style={{zIndex: 1000}}>
        {props.getMenu(dispatch).map((control: any, i: any) => {
          return (
            <div
              key={i}
              className={[
                css.menuItem,
                state.selected === i ? css.selected : null,
              ].join(' ')}
              onMouseDown={(event: MouseEvent) => {
                handleMouseDown(event, i);
              }}
              onMouseOver={(event: MouseEvent) => {
                handleMenuSelect(event, i);
              }}
            >
              {control.name}
            </div>
          );
        })}
      </div>
      {/* Drag bar - the horrible thing that keeps getting in the way of widgetry */}
      <div className={css.dragBar} style={{zIndex: 300}}>
        {renderTitle(false)}
      </div>

      {/* Window COntrols */}
      {isElectron() && <WindowsControls />}

      {/* Context Menu */}
      {state.selected !== null && (
        <ContextMenu
          testId="breaditor-menubar-contextmenu"
          left={state.contextPos.x}
          top={state.contextPos.y}
          actions={props.getMenu(dispatch)[state.selected].actions}
          onClickOut={() => {
            setState((prevState) => ({
              ...prevState,
              selected: null,
            }));
          }}
        />
      )}
    </div>
  );
};

/**
 * _ [] X
 */
function WindowsControls() {
  return (
    <div className={css.windowsControls} style={{zIndex: 400}}>
      <div
        className={css.button}
        onClick={() => {
          // @ts-ignore
          window.electronAPI.appMinimize();
        }}
      >
        <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12">
          <rect fill="currentColor" width="10" height="1" x="1" y="6"></rect>
        </svg>
      </div>
      <div
        className={css.button}
        onClick={() => {
          // @ts-ignore
          window.electronAPI.appMaximize();
        }}
      >
        <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12">
          <rect
            width="9"
            height="9"
            x="1.5"
            y="1.5"
            fill="none"
            stroke="currentColor"
          ></rect>
        </svg>
      </div>
      <div
        className={[css.close, css.button].join(' ')}
        onClick={() => {
          // @ts-ignore
          window.electronAPI.appClose();
        }}
      >
        <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12">
          <polygon
            fill="currentColor"
            fillRule="evenodd"
            points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1"
          ></polygon>
        </svg>
      </div>
    </div>
  );
}

export {MenuBar};
