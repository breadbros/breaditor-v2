/** @jest-environment jsdom */
import {act, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
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
