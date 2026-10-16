/** @jest-environment jsdom */
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import {DocumentView} from './DocumentView';
import {addDocument, _TEST_reset} from '../../breaditor/DocumentManager';
import {spriteMaker} from '../../breaditor/documents/SpriteDocument';
import {mapMaker} from '../../breaditor/documents/MapDocument';
import {textMaker} from '../../breaditor/documents/TextDocument';

jest.mock('../../breaditor/documents/SpriteDocumentView', () => ({
  SpriteDocumentView: ({document}: any) => <canvas aria-label={document.filepath} />,
}));
jest.mock('../../breaditor/documents/TextDocumentView', () => ({
  TextDocumentView: ({document}: any) => <div aria-label={document.filepath} />,
}));
jest.mock('../../breaditor/documents/MapDocumentView', () => ({
  MapDocumentView: ({document}: any) => <canvas id={document.info.id} aria-label={`${document.info.title} map`} />,
}));

beforeEach(() => _TEST_reset());
afterEach(() => _TEST_reset());

test('looks up each sprite document by id rather than rendering the active document everywhere', () => {
  const first = spriteMaker('First', 'first.json');
  const second = spriteMaker('Second', 'second.json');
  addDocument(first);
  addDocument(second);
  render(<DocumentView id={second.info.id} title="Second" />);
  expect(screen.getByLabelText('second.json')).toBeInTheDocument();
  expect(screen.queryByLabelText('first.json')).not.toBeInTheDocument();
});

test('renders the requested map document', () => {
  const document = mapMaker('Other');
  addDocument(document);
  render(<DocumentView id={document.info.id} title="Other Document" />);
  expect(screen.getByLabelText('Other map')).toHaveAttribute('id', document.info.id);
});

test('renders the requested Text Document source', () => {
  const first = textMaker('First', 'first.json');
  const second = textMaker('Second', 'second.json');
  addDocument(first);
  addDocument(second);
  render(<DocumentView id={second.info.id} title="Second" />);
  expect(screen.getByLabelText('second.json')).toBeInTheDocument();
  expect(screen.queryByLabelText('first.json')).not.toBeInTheDocument();
});
