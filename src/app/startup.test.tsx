/** @jest-environment jsdom */
import {act, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import {init} from './ReactDockableApp';
import {_TEST_reset, activeDocument, getDocuments} from './breaditor/DocumentManager';

let root: ReturnType<typeof init> | undefined;

beforeEach(() => {
  _TEST_reset();
  document.body.innerHTML = '<div id="react-root"></div>';
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  _TEST_reset();
  jest.restoreAllMocks();
});

test('startup mounts the seeded documents and active-document panels without early state updates', () => {
  const warning = jest.spyOn(console, 'warn');
  act(() => { root = init(); });

  expect(getDocuments().map(doc => doc.info.type)).toEqual(['MAP', 'TEXT', 'SPRITE', 'MAP']);
  expect(activeDocument()!.info.title).toBe('Map A');
  const workspace = screen.getByTestId('breaditor-browser-workspacearea');
  expect(workspace).toHaveTextContent('Map A Document');
  expect(workspace).toHaveTextContent('Text B Document');
  expect(workspace).toHaveTextContent('Sprite C Document');
  expect(workspace).toHaveTextContent('Map D Document');
  expect(workspace).toHaveTextContent('Layers Panel');
  expect(warning).not.toHaveBeenCalled();
});

test('canceling a file dialog clears the loading shield without an error alert', async () => {
  const openFileDialog = jest.fn();
  (window as any).electronAPI = {openFileDialog};
  const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
  act(() => { root = init(); });
  const user = userEvent.setup();
  await user.click(screen.getByText('File'));
  await user.click(await screen.findByText('Open Document'));
  expect(openFileDialog).toHaveBeenCalledWith({properties: ['openFile']});
  expect(document.getElementById('click-shield')).not.toBeNull();

  act(() => {
    document.getElementById('react-root')!.dispatchEvent(new CustomEvent('OPEN_FILE_CANCELLED'));
  });
  expect(document.getElementById('click-shield')).toBeNull();
  expect(alert).not.toHaveBeenCalled();
});
