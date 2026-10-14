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

test.each([mapMaker, textMaker])('preserves the existing view for other document types', make => {
  const document = make('Other');
  addDocument(document);
  render(<DocumentView id={document.info.id} title="Other Document" />);
  expect(screen.getByText('Other Document')).toHaveAttribute('id', document.info.id);
});
