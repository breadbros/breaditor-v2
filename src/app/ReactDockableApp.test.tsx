/**
 * @jest-environment jsdom
 */

import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import {
  App,
  createPanelStateForDocumentInfoList,
  createPanelStateForWidgetInfoList,
} from './ReactDockableApp';

import {addDocument, _TEST_reset} from './breaditor/DocumentManager';
import {mapMaker} from './breaditor/documents/MapDocument';

beforeEach(() => _TEST_reset());
afterEach(() => _TEST_reset());

describe('App', () => {
  it('renders the component correctly', () => {
    render(<App />);

    const app = screen.getByTestId('breaditor-browser-app');
    const workspaceArea = screen.getByTestId('breaditor-browser-workspacearea');
    const statusBar = screen.getByTestId('breaditor-browser-statusbar');

    expect(app).toBeInTheDocument();
    expect(statusBar).toHaveTextContent('Welcome to the Breaditor');
    expect(workspaceArea).not.toHaveTextContent('Layers Panel');
  });

  it('We can click on menu items', async () => {
    const {getByText} = render(<App />);

    const menuBar = screen.getByTestId('breaditor-browser-menubar');

    expect(menuBar).not.toHaveTextContent('Panels on');

    await userEvent.click(getByText('Test'));
    await screen.findByTestId('breaditor-menubar-contextmenu');

    expect(menuBar).toHaveTextContent('Panels on');
    const openMenu = screen.getByTestId('breaditor-menubar-contextmenu');
    expect(openMenu).toHaveTextContent('Panels on');
  });

  it('toggles panels off and on while restoring the document workspace', async () => {
    const user = userEvent.setup();
    addDocument(mapMaker('Map A'));
    render(<App />);
    const workspace = screen.getByTestId('breaditor-browser-workspacearea');
    expect(workspace).not.toHaveTextContent('Layers Panel');

    async function toggle(label: string) {
      await user.click(screen.getByText('Test'));
      await user.click(await screen.findByText(label));
    }

    await toggle('Panels on');
    expect(workspace).toHaveTextContent('Layers Panel');
    expect(workspace).toHaveTextContent('Map A Document');

    await toggle('Panels off');
    expect(workspace).not.toHaveTextContent('Layers Panel');
    expect(workspace).not.toHaveTextContent('Map A Document');

    await toggle('Panels on');
    expect(workspace).toHaveTextContent('Layers Panel');
    expect(workspace).toHaveTextContent('Map A Document');
    await toggle('Panels off');
  });
});

test('createPanelStateForDocumentInfoList', () => {
  const input = [
    {id: 'Docuuid_20', title: 'Test Map A Document', type: 'MAP'},
    {id: 'Docuuid_21', title: 'Test Sprite B Document', type: 'SPRITE'},
    {id: 'Docuuid_22', title: 'Test Source Code C Document', type: 'TEXT'},
    {id: 'Docuuid_23', title: 'Test Map D Document', type: 'MAP'},
  ];
  const result = createPanelStateForDocumentInfoList(input);

  const expected = [
    {
      windows: [
        {
          selected: 0,
          widgets: ['Docuuid_20', 'Docuuid_21', 'Docuuid_22', 'Docuuid_23'],
        },
      ],
    },
  ];

  expect(result).toEqual(expected);
});

test('createPanelStateForWidgetInfoList', () => {
  const input = [
    {id: 'PanelLayers', title: 'Layers Panel'},
    {id: 'PanelInfo', title: 'Info Panel'},
    {id: 'PanelEntities', title: 'Entities Panel'},
    {id: 'PanelZones', title: 'Zones Panel'},
    {id: 'PanelScreenview', title: 'Screenview Panel'},
  ];
  const result = createPanelStateForWidgetInfoList(input);
  const expected = [
    {
      windows: [
        {selected: 0, widgets: ['PanelLayers', 'PanelInfo']},
        {selected: 0, widgets: ['PanelEntities', 'PanelZones']},
        {selected: 0, widgets: ['PanelScreenview']},
      ],
    },
  ];
  expect(result).toEqual(expected);
});
