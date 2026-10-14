// Separate browser bundle, loaded only when a Text Document is displayed.
import {json} from 'monaco-editor/esm/vs/index';

// Sprite definitions, including Lord Stan, contain JSON comments.
json.jsonDefaults.setDiagnosticsOptions({
  ...json.jsonDefaults.diagnosticsOptions,
  allowComments: true,
  comments: 'ignore',
});

export * from 'monaco-editor/esm/vs/index';
