import type {BrowserWindow} from 'electron';
import {registerUnsavedMapGuard} from './mapUnsavedChanges';
const choice = jest.fn();
jest.mock('electron', () => ({dialog: {showMessageBoxSync: (...args: any[]) => choice(...args)}}));
test.each([0, 1])('unsaved close choice %s keeps editing unless discard is explicit', value => {
  let guard!: (event: {preventDefault: jest.Mock}) => void;
  const window = {webContents: {on: (_name: string, listener: typeof guard) => {guard = listener;}}};
  registerUnsavedMapGuard(window as unknown as BrowserWindow);
  choice.mockReturnValue(value); const event = {preventDefault: jest.fn()}; guard(event);
  expect(event.preventDefault).toHaveBeenCalledTimes(value === 1 ? 1 : 0);
});
