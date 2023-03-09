import React, {useState /*, useReducer*/} from 'react';
import {createRoot} from 'react-dom/client';
import {WindowProxy} from './layout/components/WindowProxy';
import {MenuBar} from './layout/components/MenuBar';
import {ToolBar} from './layout/components/ToolBar';
import {PropertyBar} from './layout/components/PropertyBar';
import {StatusBar} from './layout/components/StatusBar';

import {WorkspaceArea} from './layout/components/WorkspaceArea';

// import {DocumentsContainer} from './layout/components/DocumentsContainer';
// @ts-ignore
import css from './ReactDockableApp.module.css';

import {TOOLS} from './breaditor/tools/constants';

import {PanelState} from 'react-dockable-ts';
//import {TestPanel} from './breaditor/panels/TestPanel';

export function App() {
  const [panelState, setPanelState] = useState<PanelState[]>([
    {
      windows: [
        {
          selected: 0,
          widgets: ['PanelA', 'PanelB'],
        },
        {
          selected: 0,
          widgets: ['PanelC', 'PanelD', 'PanelE'],
        },
        {
          selected: 0,
          widgets: ['PanelF'],
        },
      ],
    },
  ]);

  const [docPanelState, setDocPanelState] = useState<PanelState[]>([
    {
      windows: [
        {
          selected: 0,
          widgets: ['DocA', 'DocB'],
        },
      ],
    },
  ]);

  return (
    <WindowProxy
      events={
        {
          // keydown: this.handleKeyDown,
          // keyup: this.handleKeyUp,
        }
      }
    >
      <div
        className={css.App}
        style={{
          display: 'flex',
          flexDirection: 'column',
          // Dark Theme
        }}
      >
        <MenuBar
          dispatch={(foo) => {
            console.log('I am a fake dispatch in ReactDockableApp.  Yay.', foo);
          }}
          widgets={
            {
              /*this.getWidgets()
            .filter((widget) => !widget.props.unhidable)
            .map((widget) => ({
              id: widget.props.id,
              title: widget.props.title,
            }))*/
            }
          }
          hidden={
            {
              /*this.getState().widgets.hidden*/
            }
          }
        />
        <PropertyBar
          state={{}}
          dispatch={(bar) => {
            console.log('Another fake dispatch that was passed: ', bar);
          }}
          tool={TOOLS.Brush}
          view={{}}
        />
        <div
          style={{
            flexGrow: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'row',
            height: 'calc(100vh - 128px)',
          }}
        >
          <ToolBar
            selected={{}}
            dispatch={(foo) => {
              console.log('A fake dispatch that was passed: ', foo);
            }}
          />
          <WorkspaceArea
            style={{
              flexGrow: 1,
              maxWidth: `calc(100% - 47px)`,

              margin: '1px 0 0 1px',
              // margin: 3,
            }}
            initialPanelState={panelState}
            setPanelState={setPanelState}
            initialDocumentsState={docPanelState}
            setDocumentState={setDocPanelState}
            documents={[
              {id: 'DocA', title: 'Document A'},
              {id: 'DocB', title: 'Document B'},
            ]}
            panels={[
              {id: 'PanelA', title: 'Panel A'},
              {id: 'PanelB', title: 'Panel B'},
              {id: 'PanelC', title: 'Panel C'},
              {id: 'PanelD', title: 'Panel D'},
              {id: 'PanelE', title: 'Panel E'},
              {id: 'PanelF', title: 'Panel F'},
            ]}
          />
        </div>
        <StatusBar
          state={{}}
          dispatch={(bar) => {
            console.log('Another fake dispatch that was passed: ', bar);
          }}
          tool={TOOLS.Brush}
          view={{}}
        />
      </div>
    </WindowProxy>
  );
}

export function init() {
  const domNode = document.getElementById('react-root') as Element;
  console.log(domNode, 'domNode');
  const root = createRoot(domNode);

  root.render(<App />);
}
