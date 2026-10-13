/** @jest-environment jsdom */
import React from 'react';
import {act, render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import {DevelopmentUpdateToast} from './DevelopmentUpdateToast';

afterEach(() => { window.electronAPI = undefined; });

test('stays hidden outside the development watcher', () => {
  render(<DevelopmentUpdateToast />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('offers one persistent notification and reloads only on user action', async () => {
  let notify: (available: boolean) => void = () => {};
  const unsubscribe = jest.fn();
  const reloadDevelopment = jest.fn();
  window.electronAPI = {
    onDevelopmentUpdate: callback => { notify = callback; return unsubscribe; },
    reloadDevelopment,
  };
  const {unmount} = render(<DevelopmentUpdateToast />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  act(() => { notify(true); });
  act(() => { notify(true); });
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status')).toHaveTextContent('New changes are available.');
  expect(reloadDevelopment).not.toHaveBeenCalled();

  const user = userEvent.setup();
  await user.tab();
  expect(screen.getByRole('button', {name: 'Reload'})).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(reloadDevelopment).toHaveBeenCalledTimes(1);

  act(() => { notify(false); });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test('handles updates already available when the renderer subscribes', () => {
  window.electronAPI = {
    onDevelopmentUpdate: callback => { callback(true); return jest.fn(); },
  };
  render(<DevelopmentUpdateToast />);
  expect(screen.getByRole('button', {name: 'Reload'})).toBeInTheDocument();
});

test('labels changes that require restarting the app explicitly', async () => {
  const reloadDevelopment = jest.fn();
  window.electronAPI = {
    onDevelopmentUpdate: callback => { callback(true, true); return jest.fn(); },
    reloadDevelopment,
  };
  render(<DevelopmentUpdateToast />);
  expect(screen.queryByRole('button', {name: 'Reload'})).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', {name: 'Restart app'}));
  expect(reloadDevelopment).toHaveBeenCalledTimes(1);
});
