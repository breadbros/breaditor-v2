/**
 * @jest-environment jsdom
 */
import {appendGlobalCss} from './renderer';
import {JSDOM} from 'jsdom';

// Define a global variable to store the JSDOM instance
let dom: any;

// Set up the testing environment before each test
beforeEach(() => {
  // Create a new JSDOM instance
  dom = new JSDOM(
    '<html><head></head><body><div id="react-root"></div></body></html>',
  );

  // Set the global window and document objects to the JSDOM instances
  global.window = dom.window;
  global.document = dom.window.document;
});

// Clean up the testing environment after each test
afterEach(() => {
  // Destroy the JSDOM instance
  dom.window.close();
});

test('appendGlobalCss', () => {
  // Get all the <style> elements within the <head> element
  let styleElements = document.head.querySelectorAll('style');

  const oldLength = styleElements.length;
  appendGlobalCss();
  styleElements = document.head.querySelectorAll('style');
  expect(styleElements.length).toBe(oldLength + 1);
});
