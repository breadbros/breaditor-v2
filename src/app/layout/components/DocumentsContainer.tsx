import React from 'react';
import Dockable from 'react-dockable-ts';
// import {Widget} from './Widget';
// import {MapDocument} from '../../breaditor/documents/MapDocument';

interface DocumentsContainerProps {
  state: any;
  dispatch: (arg: any) => void;
  currentTool: any;
  unhidable?: boolean;
}

const DocumentsContainer: React.FC<DocumentsContainerProps> = (props) => {
  // Manages the Dockable container of Documents

  let {state, dispatch} = props;
  dispatch = dispatch;

  return (
    <div
      style={{display: 'flex', flexGrow: 1, width: '100%', height: '100%'}}
      data-testid="breaditor-documents-container"
    >
      <Dockable
        initialState={state.documents.workspace}
        spacing={3}
        active={state.documents.activeDocument}
        // hideMenus
        hideTabs={state.documents.views.length <= 1}
        onUpdate={(panelState) => {
          console.log(
            "DocumentsContainer.tsx's Dockable's onUpdate: ",
            panelState,
          );
        }}
      >
        {state.documents.views.map((view: any) => {
          console.log('map view:', view);
          // import {Widget} from './Widget';
          // import {MapDocument} from '../../breaditor/documents/MapDocument';
          return <div />;
        })}
      </Dockable>
    </div>
  );
};

export {DocumentsContainer};
