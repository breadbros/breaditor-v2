/** @jest-environment jsdom */
import {PanelState} from 'react-dockable-ts';
import {loadPanelLayout, savePanelLayout} from './panelLayoutStorage';

const defaults: PanelState[] = [{windows: [{selected: 0, widgets: ['A', 'B']}]}];
beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

test('round-trips grouping, order, selection and both dimensions separately per type and area', () => {
  const layout = [{size: 400, windows: [{size: 200, selected: 1, widgets: ['B', 'A']}]}];
  savePanelLayout('MAP', 'panels', ['A', 'B'], layout);
  savePanelLayout('SPRITE', 'panels', ['A', 'B'], []);
  expect(loadPanelLayout('MAP', 'panels', ['A', 'B'], defaults)).toEqual(layout);
  expect(loadPanelLayout('SPRITE', 'panels', ['A', 'B'], defaults)).toEqual([]);
  expect(loadPanelLayout('MAP', 'workspace', ['A', 'B'], defaults)).toEqual(defaults);
  expect(loadPanelLayout('FUTURE', 'panels', ['A', 'B'], defaults)).toEqual(defaults);
});

test('keeps closed panels closed, removes obsolete panels and opens newly added panels', () => {
  savePanelLayout('MAP', 'panels', ['A', 'B', 'obsolete'], [{windows: [{selected: 1, widgets: ['obsolete', 'A', 'A']}]}]);
  expect(loadPanelLayout('MAP', 'panels', ['A', 'B', 'new'], defaults)).toEqual([
    {windows: [{selected: 0, widgets: ['A']}]},
    {windows: [{selected: 0, widgets: ['new']}]},
  ]);
});

test.each(['bad json', '{}', '{"ids":[],"layout":[null]}', '{"ids":[],"layout":[{"windows":[{}]}]}'])('falls back for corrupt storage: %s', raw => {
  localStorage.setItem('breaditor.layout.v1.MAP.panels', raw);
  expect(loadPanelLayout('MAP', 'panels', ['A', 'B'], defaults)).toEqual(defaults);
});

test('ignores invalid dimensions and selected indices', () => {
  savePanelLayout('MAP', 'panels', ['A', 'B'], [{size: -10, windows: [{selected: -1, widgets: ['A']}]}]);
  expect(loadPanelLayout('MAP', 'panels', ['A', 'B'], defaults)).toEqual([{windows: [{selected: 0, widgets: ['A']}]}]);
});

test('unavailable storage does not break layout changes', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {throw new Error('blocked');});
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {throw new Error('full');});
  expect(loadPanelLayout('MAP', 'panels', ['A', 'B'], defaults)).toEqual(defaults);
  expect(() => savePanelLayout('MAP', 'panels', ['A', 'B'], [])).not.toThrow();
});
