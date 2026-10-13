/** @jest-environment jsdom */
import {_TEST_setStateHandlers, updateDocumentManagerState} from './ReactDockableApp';

beforeEach(() => {
  _TEST_setStateHandlers(undefined as any, undefined as any);
});
afterEach(() => jest.restoreAllMocks());

test('document state updates before mounting warn without crashing', () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  expect(() => updateDocumentManagerState([], [])).not.toThrow();
  expect(warning).toHaveBeenCalledWith(expect.stringContaining('_setPanelState not yet initialized'));
});

test('mounted document updates reach the correct state handlers', () => {
  const setPanels = jest.fn();
  const setDocuments = jest.fn();
  _TEST_setStateHandlers(setPanels, setDocuments);
  const documents: Parameters<typeof updateDocumentManagerState>[0] = [];
  const panels: Parameters<typeof updateDocumentManagerState>[1] = [];
  updateDocumentManagerState(documents, panels);
  expect(setPanels.mock.calls[0][0]).toBe(panels);
  expect(setDocuments.mock.calls[0][0]).toBe(documents);
});
