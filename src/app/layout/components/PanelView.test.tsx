/** @jest-environment jsdom */
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import {activeDocument} from '../../breaditor/DocumentManager';
import {spriteMaker} from '../../breaditor/documents/SpriteDocument';
import {mapMaker} from '../../breaditor/documents/MapDocument';
import {PanelView} from './PanelView';

jest.mock('../../breaditor/DocumentManager', () => ({activeDocument: jest.fn()}));
jest.mock('../../breaditor/panels/SpriteInfoPanel', () => ({
  SpriteInfoPanel: ({document}: any) => <section aria-label={document.filepath} />,
}));
jest.mock('../../breaditor/documents/MapDocumentView', () => ({
  MapDocumentPanel: ({document, id, title}: any) => <section id={id} aria-label={`${document.info.title} map panel`}>{title}</section>,
}));

test('shows sprite info for the active document and follows document switching', () => {
  (activeDocument as jest.Mock).mockReturnValue(spriteMaker('First', 'first.json'));
  const {rerender} = render(<PanelView id="PanelInfo" title="Info Panel" />);
  expect(screen.getByLabelText('first.json')).toBeInTheDocument();
  (activeDocument as jest.Mock).mockReturnValue(spriteMaker('Second', 'second.json'));
  rerender(<PanelView id="PanelInfo" title="Info Panel" />);
  expect(screen.getByLabelText('second.json')).toBeInTheDocument();
  expect(screen.queryByLabelText('first.json')).not.toBeInTheDocument();
});

test.each([null, mapMaker('Map')])('renders an info panel for an empty workspace or map', document => {
  (activeDocument as jest.Mock).mockReturnValue(document);
  render(<PanelView id="PanelInfo" title="Info Panel" />);
  expect(screen.getByText('Info Panel')).toHaveAttribute('id', 'PanelInfo');
  if (document) expect(screen.getByLabelText('Map map panel')).toBeInTheDocument();
});

test('preserves other panels for sprite documents', () => {
  (activeDocument as jest.Mock).mockReturnValue(spriteMaker('Sprite'));
  render(<PanelView id="PanelPalette" title="Palette Panel" />);
  expect(screen.getByText('Palette Panel')).toHaveAttribute('id', 'PanelPalette');
});
