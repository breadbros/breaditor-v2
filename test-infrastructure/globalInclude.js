// This file will execute at the beginning of EVERY tested file...
//console.log('test-infrastructure/globalInclude.js is executing...');

const TextEncoder = require('util').TextEncoder;
const TextDecoder = require('util').TextDecoder;

// global.customLog = function (message) {
//   console.log(`[CUSTOM LOG] ${message}`);
// };

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

global.screenDebugToAnsiFile = function (filename, screen, obj) {
  const {prettyDOM} = require('@testing-library/react');
  function stringToDataView(str) {
    const buffer = new ArrayBuffer(str.length);
    const view = new DataView(buffer);
    for (let i = 0; i < str.length; i++) {
      view.setUint8(i, str.charCodeAt(i));
    }
    return view;
  }
  const fs = require('fs');
  const dataView = stringToDataView(prettyDOM(obj, 10000000));

  fs.writeFileSync(filename, dataView);
};

// console.log('...test-infrastructure/globalInclude.js is done.');
