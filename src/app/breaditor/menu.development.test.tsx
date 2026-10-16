/** @jest-environment jsdom */
import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import {getMenu} from './menu';
import {MenuBar} from '../layout/components/MenuBar';

const originalAPI = window.electronAPI;
afterEach(() => {window.electronAPI = originalAPI; jest.restoreAllMocks();});

test.each([undefined, false])('omits the Dev menu when development is %s', isDevelopment => {
  window.electronAPI = isDevelopment === undefined ? undefined : {isDevelopment};
  expect(getMenu(jest.fn()).map(menu => menu.name)).not.toContain('Dev');
});

test('places Dev directly after Help and reloads the current window from its menu item', () => {
  window.electronAPI = {isDevelopment: true};
  const reload = jest.fn();
  jest.spyOn(window, 'location', 'get').mockReturnValue({reload} as unknown as Location);
  const names = getMenu(jest.fn()).map(menu => menu.name);
  expect(names.indexOf('Dev')).toBe(names.indexOf('Help') + 1);
  render(<MenuBar dispatch={jest.fn()} widgets={[]} hidden={{}} getMenu={getMenu} />);
  fireEvent.mouseDown(screen.getByText('Dev', {exact: true}));
  fireEvent.click(screen.getByText('Reload Window', {exact: true}));
  expect(reload).toHaveBeenCalledTimes(1);
});
