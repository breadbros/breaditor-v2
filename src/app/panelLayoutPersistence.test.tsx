/** @jest-environment jsdom */
import React from 'react';
import {act, fireEvent, screen, within} from '@testing-library/react';
import '@testing-library/jest-dom';
import {init} from './ReactDockableApp';
import {_TEST_reset} from './breaditor/DocumentManager';

jest.mock('./breaditor/documents/MapDocumentView', () => ({MapDocumentView: () => <div>Map view</div>, MapDocumentPanel: ({id}: {id: string}) => <div id={id}>{id}</div>}));
jest.mock('./breaditor/documents/SpriteDocumentView', () => ({SpriteDocumentView: () => <div>Sprite view</div>}));
jest.mock('./breaditor/documents/TextDocumentView', () => ({TextDocumentView: () => <div>Text view</div>}));
jest.mock('./breaditor/panels/SpriteInfoPanel', () => ({SpriteInfoPanel: () => <div>Sprite info</div>}));

let root: ReturnType<typeof init>;
function mount() {
  document.body.innerHTML = '<div id="react-root"></div>';
  act(() => {root = init();});
}
function focus(title: string) {fireEvent.mouseDown(screen.getByText(`${title} Document`));}
function toggle(title: string) {
  fireEvent.mouseDown(screen.getByText('Panels', {exact: true}));
  fireEvent.click(within(screen.getByTestId('breaditor-menubar-contextmenu')).getByText(title));
}
function tabs() {
  return [...document.querySelectorAll('#panels-container [data-rbd-draggable-id]')].map(tab => tab.textContent);
}

beforeEach(() => {localStorage.clear(); _TEST_reset(); mount();});
afterEach(() => {act(() => root.unmount()); _TEST_reset();});

test('shares map layouts across maps and restores separate map, text and sprite visibility after remount', () => {
  toggle('Zones Panel');
  fireEvent.mouseDown(screen.getByText('Info Panel', {exact: true}));
  expect(document.getElementById('PanelInfo')).toBeInTheDocument();
  focus('Map D');
  expect(tabs()).not.toContain('Zones Panel');
  expect(document.getElementById('PanelInfo')).toBeInTheDocument();
  focus('Text B');
  toggle('Todo Panel');
  expect(tabs()).toEqual([]);
  focus('Sprite C');
  toggle('Palette Panel');
  focus('Map A');
  expect(tabs()).not.toContain('Zones Panel');
  expect(tabs()).toContain('Tileset Panel');

  act(() => root.unmount());
  _TEST_reset();
  mount();
  expect(tabs()).not.toContain('Zones Panel');
  expect(document.getElementById('PanelInfo')).toBeInTheDocument();
  focus('Text B'); expect(tabs()).toEqual([]);
  focus('Sprite C'); expect(tabs()).toEqual(['Info Panel']);
  toggle('Palette Panel'); expect(tabs()).toContain('Palette Panel');
});
