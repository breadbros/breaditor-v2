/** @jest-environment jsdom */
import React, {useState} from 'react';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import {DocumentControls, DocumentControlsProvider} from './DocumentControls';
import {PropertyBar} from './PropertyBar';
import {TOOLS} from '../../breaditor/tools/constants';

function Document({id}: {id: string}) {
  const [clicks, setClicks] = useState(0);
  return <section aria-label={id}>
    <DocumentControls documentId={id}>
      <button onClick={() => setClicks(value => value + 1)}>{id}: {clicks}</button>
    </DocumentControls>
  </section>;
}

function Workspace({active}: {active: string | null}) {
  return <DocumentControlsProvider documentId={active}>
    <PropertyBar state={{activeTool: TOOLS.Brush}} dispatch={jest.fn()} view={{}} />
    <Document id="first" />
    <Document id="second" />
  </DocumentControlsProvider>;
}

test('only the focused document uses the top bar, retaining each mounted view state', async () => {
  const user = userEvent.setup();
  const {rerender} = render(<Workspace active="first" />);
  const toolbar = screen.getByRole('toolbar', {name: 'Sprite controls'});
  await user.click(within(toolbar).getByRole('button', {name: 'first: 0'}));
  expect(within(toolbar).getByRole('button', {name: 'first: 1'})).toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'second: 0'})).not.toBeInTheDocument();
  expect(within(screen.getByLabelText('first')).queryByRole('button')).not.toBeInTheDocument();
  rerender(<Workspace active="second" />);
  await user.click(within(toolbar).getByRole('button', {name: 'second: 0'}));
  expect(screen.queryByRole('button', {name: 'first: 1'})).not.toBeInTheDocument();
  rerender(<Workspace active="first" />);
  expect(within(toolbar).getByRole('button', {name: 'first: 1'})).toBeInTheDocument();
});

test('switching away from sprites restores brush properties and removes sprite controls', () => {
  const {rerender, unmount} = render(<Workspace active="first" />);
  expect(screen.queryByText('Size:')).not.toBeInTheDocument();
  rerender(<Workspace active={null} />);
  const toolbar = screen.getByRole('toolbar', {name: 'Tool properties'});
  for (const name of ['Size', 'Flow', 'Hardness', 'Spacing']) {
    expect(within(toolbar).getByText(`${name}:`)).toBeInTheDocument();
  }
  expect(screen.queryByRole('button', {name: /first:/})).not.toBeInTheDocument();
  rerender(<Workspace active="second" />);
  expect(screen.queryByText('Size:')).not.toBeInTheDocument();
  expect(within(screen.getByRole('toolbar', {name: 'Sprite controls'})).getByRole('button', {name: 'second: 0'})).toBeInTheDocument();
  unmount();
  expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
});
