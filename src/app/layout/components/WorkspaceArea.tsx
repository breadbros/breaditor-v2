import React, {
  useState,
  // useRef,
  //useEffect,
  Dispatch,
  SetStateAction,
} from 'react';
import {Dockable, PanelState} from 'react-dockable-ts';
import {DocumentInfo, WidgetInfo} from '../../../../types/global';
import {Widget} from './Widget';


import {
  focusDocument,
} from '../../breaditor/DocumentManager';

// @ts-ignore
import css from './WorkspaceArea.module.css';
//import {dispatch} from '../../state-management/in-memory/dispatch';

interface WorkspaceAreaProps {
  style: any;
  initialPanelState: PanelState[];
  setPanelState: Dispatch<SetStateAction<PanelState[]>>;
  initialDocumentsState: PanelState[];
  setDocumentState: Dispatch<SetStateAction<PanelState[]>>;

  documents: DocumentInfo[];
  panels: WidgetInfo[];
  themeClass: string;

  dispatch: ({}: any) => void;
}
const WorkspaceArea: React.FC<WorkspaceAreaProps> = (props) => {
  const {dispatch} = props;

  const [layoutState, setLayoutState] = useState<PanelState[]>([
    {
      windows: [
        {
          selected: 0,
          widgets: ['documents-container'],
          hideTabs: true,
        },
      ],
    },
    {
      windows: [
        {
          selected: 0,
          widgets: ['panels-container'],
          hideTabs: true,
        },
      ],
    },
  ]);

  return (
    <div style={props.style}>
      <Dockable
        initialState={layoutState}
        onUpdate={(state) => {
          setLayoutState(state);
        }}
        spacing={3}
        testId="breaditor-browser-workspacearea"
        themeClass={css.rootTheme}
      >
        <div
          title={'Documents (Should Be Hidden)'}
          id={'documents-container'}
          style={{
            display: 'flex',
            flexGrow: 1,
            width: '100%',
            height: '100%',
            backgroundColor: 'var(--borderColor)',
          }}
        >
          <Dockable
            initialState={props.initialDocumentsState}
            onUpdate={(state) => {
              props.setDocumentState(state);
            }}
            onActive={(id) => {
              // dispatch({type: 'DOC_FOCUS', document_id: id});
              focusDocument(id);
            }}
            spacing={3}
            themeClass={props.themeClass}
          >
            {props.documents.map((doc) => {
              return <Widget key={doc.id} id={doc.id} title={doc.title} />;
            })}
          </Dockable>
        </div>
        <div
          title={'Panels (Should Be Hidden)'}
          id={'panels-container'}
          style={{
            display: 'flex',
            flexGrow: 1,
            width: '100%',
            height: '100%',
            backgroundColor: 'var(--borderColor)',
          }}
        >
          <Dockable
            initialState={props.initialPanelState}
            onUpdate={(state) => {
              props.setPanelState(state);
            }}
            spacing={3}
            themeClass={props.themeClass}
          >
            {props.panels.map((panel) => {
              return (
                <Widget id={panel.id} key={panel.id} title={panel.title} />
              );
            })}
          </Dockable>
        </div>
      </Dockable>
    </div>
  );
};

export {WorkspaceArea};
