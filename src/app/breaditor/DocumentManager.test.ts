/**
 * @jest-environment jsdom
 */

import {mapMaker} from '../breaditor/documents/MapDocument';
import {spriteMaker} from '../breaditor/documents/SpriteDocument';
import {textMaker} from '../breaditor/documents/TextDocument';
import {_TEST_setStateHandlers} from '../ReactDockableApp';
import {
  _TEST_reset,
  activeDocument,
  addDocument,
  focusDocument,
  getDocuments,
  removeDocument,
  createInitialPanelInfoForDocumentType,
  createInitialDocumentInfoForLoadedDocuments,
} from './DocumentManager';

beforeEach(() => {
  _TEST_setStateHandlers(
    (a: any) => {
      a = a;
    },
    (b: any) => {
      b = b;
    },
  );
  _TEST_reset();
});

test('the first added document defaults active', () => {
  expect(activeDocument()).toBe(null);
  const myDoc = mapMaker('Test Map A');
  addDocument(myDoc);
  expect(activeDocument()).toBe(myDoc);
});

test('uninitialized activeDocument returns null', () => {
  expect(activeDocument()).toBe(null);
});

test('addDocument creates unique ids to documents in the Widget Info', () => {
  const map1 = mapMaker('Test Map A');
  const map2 = mapMaker('Test Map B');

  expect(map1.info.id).toBeFalsy();
  expect(map2.info.id).toBeFalsy();

  addDocument(map1);
  addDocument(map2);

  expect(map1.info.id).toBeTruthy();
  expect(map2.info.id).toBeTruthy();

  expect(map1.info.id).not.toBe(map2.info.id);
});

test('getDocuments works', () => {
  const map1 = mapMaker('Test Map A');
  const map2 = mapMaker('Test Map B');
  const map3 = mapMaker('Test Map C');

  const map4 = mapMaker('Test Map C');

  addDocument(map1);
  addDocument(map2);
  addDocument(map3);

  const allDocs = getDocuments();

  expect(allDocs.length).toBe(3);
  expect(allDocs.some((item) => item === map1)).toBeTruthy();
  expect(allDocs.some((item) => item === map2)).toBeTruthy();
  expect(allDocs.some((item) => item === map3)).toBeTruthy();
  expect(allDocs.some((item) => item === map4)).toBeFalsy();
});

test('removeDocument works', () => {
  const map1 = mapMaker('Test Map A');
  const map2 = mapMaker('Test Map B');
  const map3 = mapMaker('Test Map C');

  const okayThing = function okayThing() {};

  okayThing();

  addDocument(map1);
  addDocument(map2);
  addDocument(map3);

  expect(getDocuments().length).toBe(3);

  removeDocument(map2);

  expect(getDocuments().length).toBe(2);

  expect(getDocuments().length).toBe(2);
  expect(getDocuments().some((item) => item === map1)).toBeTruthy();
  expect(getDocuments().some((item) => item === map2)).toBeFalsy();
  expect(getDocuments().some((item) => item === map3)).toBeTruthy();
});

test('removeDocument throws exception if you try to remove something not in it', () => {
  const map1 = mapMaker('Test Map A');
  const map2 = mapMaker('Test Map B');

  addDocument(map1);
  addDocument(map2);

  const map3 = mapMaker('Test Map C');
  const blowUp = function blowUp() {
    removeDocument(map3);
  };

  expect(blowUp).toThrowError(
    'Document () was not in the active document list',
  );

  const map4 = mapMaker('Test Map D');
  map4.info.id = 'Some bogus id';
  const blowUpAgain = function blowUp() {
    removeDocument(map4);
  };
  expect(blowUpAgain).toThrowError(
    'Document (Some bogus id) was not in the active document list',
  );
});

test('Deleting the active document will make the document to its left active, if possible', () => {
  const map1 = mapMaker('Test Map A');
  const map2 = mapMaker('Test Map B');
  const map3 = mapMaker('Test Map C');
  addDocument(map1);
  addDocument(map2);
  addDocument(map3);

  expect(map1).toBe(activeDocument());
  focusDocument(map3.info.id);
  expect(map3).toBe(activeDocument());
  removeDocument(map3);
  expect(map2).toBe(activeDocument());
});

test('Deleting the leftmost active document will make the new leftmost document active, if possible', () => {
  const map1 = mapMaker('Test Map A');
  const map2 = mapMaker('Test Map B');
  const map3 = mapMaker('Test Map C');
  addDocument(map1);
  addDocument(map2);
  addDocument(map3);

  expect(map1).toBe(activeDocument());
  removeDocument(map1);
  expect(map2).toBe(activeDocument());
});

test('Deleting the last document will result in a null active document', () => {
  const map1 = mapMaker('Test Map A');
  addDocument(map1);

  expect(map1).toBe(activeDocument());
  removeDocument(map1);
  expect(activeDocument()).toBeNull();
});

test('verify initial panel info for maps', () => {
  const mapPanels = createInitialPanelInfoForDocumentType('MAP');

  const expected = [
    {id: 'PanelLayers', title: 'Layers Panel'},
    {id: 'PanelInfo', title: 'Info Panel'},
    {id: 'PanelEntities', title: 'Entities Panel'},
    {id: 'PanelZones', title: 'Zones Panel'},
    {id: 'PanelScreenview', title: 'Screenview Panel'},
  ];

  expect(mapPanels).toEqual(expected);
});

test('verify initial panel info for text', () => {
  const textPanels = createInitialPanelInfoForDocumentType('TEXT');

  const expected = [{id: 'PanelTodo', title: 'Todo Panel'}];

  expect(textPanels).toEqual(expected);
});

test('verify initial panel info for sprite', () => {
  const spritePanels = createInitialPanelInfoForDocumentType('SPRITE');

  const expected = [
    {id: 'PanelInfo', title: 'Info Panel'},
    {id: 'PanelPalette', title: 'Palette Panel'},
  ];

  expect(spritePanels).toEqual(expected);
});

test('verify initial document info for active document set', () => {
  const map1 = mapMaker('Test Map A');
  const sprite = spriteMaker('Test Sprite B');
  const code = textMaker('Test Source Code C');
  const map2 = mapMaker('Test Map D');
  addDocument(map1);
  addDocument(sprite);
  addDocument(code);
  addDocument(map2);

  const info = createInitialDocumentInfoForLoadedDocuments();
  const expected = [
    {id: 'Docuuid_20', title: 'Test Map A Document', type: 'MAP'},
    {id: 'Docuuid_21', title: 'Test Sprite B Document', type: 'SPRITE'},
    {id: 'Docuuid_22', title: 'Test Source Code C Document', type: 'TEXT'},
    {id: 'Docuuid_23', title: 'Test Map D Document', type: 'MAP'},
  ];

  // let's not compare the ids.  they're silly and should be uuids.
  expect(info[0].title).toEqual(expected[0].title);
  expect(info[1].title).toEqual(expected[1].title);
  expect(info[2].title).toEqual(expected[2].title);
  expect(info[3].title).toEqual(expected[3].title);

  expect(info[0].type).toEqual(expected[0].type);
  expect(info[1].type).toEqual(expected[1].type);
  expect(info[2].type).toEqual(expected[2].type);
  expect(info[3].type).toEqual(expected[3].type);

  expect(info.length).toBe(expected.length);
});
