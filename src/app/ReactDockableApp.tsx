import React, {useState, useReducer, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {PanelState, loadPanelLayout, savePanelLayout} from './layout/panelLayoutStorage';
import type {DocumentType} from './breaditor/DocumentManager';

import {WindowProxy} from './layout/components/WindowProxy';
import {MenuBar} from './layout/components/MenuBar';
import {ToolBar} from './layout/components/ToolBar';
import {PropertyBar} from './layout/components/PropertyBar';
import {DocumentControlsProvider} from './layout/components/DocumentControls';
import {StatusBar} from './layout/components/StatusBar';
import {WorkspaceArea} from './layout/components/WorkspaceArea';
import {DevelopmentUpdateToast} from './ui/DevelopmentUpdateToast';

import {getMenu} from './breaditor/menu';
import {
  activeDocument,
  addDocument,
  focusDocument,
  getWidgetInfo,
  getDocumentInfo,
  createInitialDocumentInfoForLoadedDocuments,
  createInitialPanelInfoForDocumentType,
} from './breaditor/DocumentManager';

import {mapMaker, isMapDocument} from './breaditor/documents/MapDocument';
import {saveOpenMapDocument} from './breaditor/documents/mapEditorSession';
import {textMaker} from './breaditor/documents/TextDocument';
import {spriteMaker} from './breaditor/documents/SpriteDocument';
// import {TOOLS} from './breaditor/tools/constants';

import {
  breaditorAppReducer,
  getInitialState,
} from './state-management/in-memory/app_reducer';

import {DocumentInfo, WidgetInfo} from '../../types/global';

// @ts-ignore
import css from './ReactDockableApp.module.css';

let docLoaded = false;

function createInitialPanelState(): PanelState[] {
  if (!docLoaded) return [];

  const ad = activeDocument();
  if (!ad) return [];
  return createPanelStateForDocumentType(ad.info.type);
}

function createPanelStateForDocumentType(type: DocumentType): PanelState[] {
  const info = createInitialPanelInfoForDocumentType(type);
  return loadPanelLayout(type, 'panels', info.map(panel => panel.id), createPanelStateForWidgetInfoList(info));
}

function saveCurrentPanelState(type: DocumentType, panels: PanelState[]) {
  savePanelLayout(type, 'panels', createInitialPanelInfoForDocumentType(type).map(panel => panel.id), panels);
}

function togglePanel(id: string) {
  const current = activeDocument();
  if (!current) return;
  const panels = createPanelStateForDocumentType(current.info.type);
  const isOpen = panels.some(panel => panel.windows.some(win => win.widgets.includes(id)));
  const next = isOpen
    ? panels.map(panel => ({
      ...panel,
      windows: panel.windows.map(win => {
        const selected = win.widgets[win.selected];
        const widgets = win.widgets.filter(widget => widget !== id);
        return {...win, widgets, selected: Math.max(0, widgets.indexOf(selected))};
      }).filter(win => win.widgets.length),
    })).filter(panel => panel.windows.length)
    : [...panels, {windows: [{selected: 0, widgets: [id]}]}];
  saveCurrentPanelState(current.info.type, next);
  if (docLoaded) updateDocumentManagerState(getDocumentState(), next);
}

function createInitialDocumentState(): PanelState[] {
  if (!docLoaded) return [];

  return createPanelStateForDocumentInfoList(
    createInitialDocumentInfoForLoadedDocuments(),
  );
}

function createPanelStateForDocumentInfoList(info: WidgetInfo[]): PanelState[] {
  let selected = 0;
  const active = activeDocument();
  const widgets: string[] = [];
  for (let index = 0; index < info.length; index++) {
    const curId = info[index].id;

    if (active != null && active.info.id == curId) {
      selected = index;
    }

    widgets.push(info[index].id);
  }

  return [
    {
      windows: [
        {
          selected: selected,
          widgets: widgets,
        },
      ],
    },
  ];
}

function createPanelStateForWidgetInfoList(info: WidgetInfo[]): PanelState[] {
  const bin1: string[] = [];
  const bin2: string[] = [];
  const bin3: string[] = [];

  for (let index = 0; index < info.length; index++) {
    const curId = info[index].id;

    if (index < 2) {
      bin1.push(curId);
    } else if (index < 4) {
      bin2.push(curId);
    } else {
      bin3.push(curId);
    }
  }

  let ret = [{windows: []}];

  const windows: any[] = [];

  if (bin1.length > 0) {
    windows.push({
      selected: 0,
      widgets: bin1,
    });
  }

  if (bin2.length > 0) {
    windows.push({
      selected: 0,
      widgets: bin2,
    });
  }

  if (bin3.length > 0) {
    windows.push({
      selected: 0,
      widgets: bin3,
    });
  }

  // @ts-ignore
  ret[0].windows = windows;

  return ret as PanelState[];
}

function getCurrentPanels(): WidgetInfo[] {
  if (!docLoaded) return [];
  return getWidgetInfo();
}

function getCurrentDocuments(): DocumentInfo[] {
  if (!docLoaded) return [];
  return getDocumentInfo();
}

type FakeStateFn = (a: any) => void;
function _TEST_setStateHandlers(
  __setPanelState: FakeStateFn,
  __setDocPanelState: FakeStateFn,
) {
  _setPanelState = __setPanelState;
  _setDocPanelState = __setDocPanelState;
}

let _setPanelState: any;
let _setDocPanelState: any;

let _PanelState: any;
let _DocumentState: any;

let _CachedValidDocumentState: any = null;

function setOnOrOff(onOrOff: boolean) {
  let newPanelState: any;
  let newDocState: any;

  docLoaded = onOrOff;

  if (onOrOff) {
    if (_CachedValidDocumentState == null) {
      _CachedValidDocumentState = createInitialDocumentState();
    }
    newPanelState = createInitialPanelState();
    newDocState = _CachedValidDocumentState;
  } else {
    _CachedValidDocumentState = _DocumentState;
    newPanelState = [];
    newDocState = [];
  }

  updateDocumentManagerState(newDocState, newPanelState);
}

function updateDocumentManagerState(
  documentState: PanelState[],
  panelState: PanelState[],
) {
  if (_setPanelState === undefined) {
    console.warn("_setPanelState not yet initialized; was the app mounted correctly before calling for a focused document?");
    return;
  }
  _PanelState = panelState;
  _DocumentState = documentState;
  _setPanelState(panelState);
  _setDocPanelState(documentState);
}

function getDocumentState() {
  return _DocumentState;
}

const ModalClickShield = () => {
  return (
    <div
      id="click-shield"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(1, 0, 0, 0.5)',
        zIndex: 1000,
      }}
    />
  );
};

let appDispatch: any = undefined;

function doAppDispatch(data:any) {

  if(appDispatch === undefined) {
    console.error('appDispatch was not set');
  } else {
    appDispatch(data);
  }
}

function App() {
  const [state, dispatch] = useReducer(breaditorAppReducer, getInitialState());
  appDispatch = dispatch;

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !(event.ctrlKey || event.metaKey)) return;
      const current = activeDocument(), key = event.key.toLowerCase();
      if (key === 'o') {event.preventDefault(); dispatch({type: 'DOC_OPEN_EXISTING', thunkDispatch: dispatch});}
      else if (key === 'n') {event.preventDefault(); const doc = mapMaker('Untitled Map'); addDocument(doc); focusDocument(doc.info.id);}
      else if (key === 's' && isMapDocument(current)) {event.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); saveOpenMapDocument(current, event.shiftKey);}
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  useEffect(() => {
    if (state.app.isPanelsOn !== undefined) setOnOrOff(state.app.isPanelsOn);
  }, [state.app.isPanelsOn]);

  if (dispatch == undefined) {
    console.info(state);
  }

  const [panelState, setPanelState] = useState<PanelState[]>(
    createInitialPanelState(),
  );

  const [documentState, setDocumentState] = useState<PanelState[]>(
    createInitialDocumentState(),
  );

  _setPanelState = setPanelState;
  _setDocPanelState = setDocumentState;

  _PanelState = panelState;
  _DocumentState = documentState;
  const focusedDocument = activeDocument();

  return (
    <DocumentControlsProvider
      documentId={focusedDocument?.info.id ?? null}
      label={focusedDocument?.info.type === 'MAP' ? 'Map controls' : focusedDocument?.info.type === 'TEXT' ? 'Text controls' : 'Sprite controls'}>
    <WindowProxy
      events={
        {
          // keydown: this.handleKeyDown,
          // keyup: this.handleKeyUp,
        }
      }
    >
      {state.app.isLoading && (
        <>
          <ModalClickShield />
        </>
      )}

      <div
        className={css.App}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          // Dark Theme
        }}
        data-testid="breaditor-browser-app"
      >
        <MenuBar
          dispatch={dispatch}
          widgets={getCurrentPanels()}
          hidden={
            {
              /*this.getState().widgets.hidden*/
            }
          }
          getMenu={getMenu}
        />
        <PropertyBar state={state.tools} dispatch={dispatch} view={{}} />
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'row',
          }}
        >
          <ToolBar selected={{}} dispatch={dispatch} />
          <WorkspaceArea
            key={`main_workspace:${focusedDocument?.info.type ?? 'none'}`}
            panelsetType={focusedDocument?.info.type ?? null}
            panelsEnabled={docLoaded}
            dispatch={dispatch}
            style={{
              flexGrow: 1,
              // maxWidth: `calc(100% - 47px)`,

              // margin: "1px 0 0 1px",
              // boxSizing: "border-box",
              padding: 1,
            }}
            initialPanelState={panelState}
            setPanelState={(next) => {
              if (!docLoaded || activeDocument()?.info.type !== focusedDocument?.info.type) return;
              const panels = typeof next === 'function' ? next(_PanelState) : next;
              _PanelState = panels;
              if (focusedDocument) saveCurrentPanelState(focusedDocument.info.type, panels);
              setPanelState(panels);
            }}
            initialDocumentsState={documentState}
            setDocumentState={(next) => {
              const documents = typeof next === 'function' ? next(_DocumentState) : next;
              _DocumentState = documents;
              setDocumentState(documents);
            }}
            documents={getCurrentDocuments()}
            panels={getCurrentPanels()}
            themeClass={'nullTheme'}
          />
        </div>
        <StatusBar
          initialStatuses={['Welcome to the Breaditor', '❤', '🦵']}
          dispatch={dispatch}
        />
        <DevelopmentUpdateToast />
      </div>
    </WindowProxy>
    </DocumentControlsProvider>
  );
}

function init() {
  const domNode = document.getElementById('react-root') as HTMLElement;

  const root = createRoot(domNode);

  addDocument(mapMaker('Map A', 'assets/sully/maps/json/farmsville.map.json', 'assets/sully/', true));
  addDocument(textMaker('Text B', 'assets/lord-stan/lord_stan.json'));
  addDocument(spriteMaker('Sprite C'));
  addDocument(mapMaker('Map D'));

  /// MAIN<->RENDERER handlers
  domNode.addEventListener('OPEN_FILE_SUCCESS', (event:any) => {
    const filepath = event.detail.filePath;
    if (/\.map\.json$/i.test(filepath)) {
      const title = filepath.replace(/\\/g, '/').split('/').pop()!.replace(/\.map\.json$/i, '');
      const map = mapMaker(title, filepath);
      addDocument(map);
      focusDocument(map.info.id);
      doAppDispatch({type: 'DOC_OPEN_FILE_CANCELLED', thunkDispatch: doAppDispatch});
      return;
    }
    doAppDispatch({
      type: 'DOC_OPEN_FILE_FOUND',
      thunkDispatch: doAppDispatch,
      filePath: event.detail.filePath
    });
  });

  domNode.addEventListener('OPEN_FILE_FAILURE', (event:any) => {
    doAppDispatch({
      type: 'DOC_OPEN_FILE_FAILURE',
      thunkDispatch: doAppDispatch,
      error: 'failed to load' + event.detail.filePath
    });
  });

  domNode.addEventListener('OPEN_FILE_CANCELLED', () => {
    doAppDispatch({type: 'DOC_OPEN_FILE_CANCELLED', thunkDispatch: doAppDispatch});
  });

  docLoaded = true;
  _CachedValidDocumentState = null;
  root.render(<App />);
  return root;
}

export {
  App,
  createPanelStateForDocumentInfoList,
  createPanelStateForWidgetInfoList,
  createPanelStateForDocumentType,
  togglePanel,
  getCurrentPanels,
  init,
  setOnOrOff,
  updateDocumentManagerState,
  createInitialPanelInfoForDocumentType,
  getDocumentState,
  _TEST_setStateHandlers,
};
