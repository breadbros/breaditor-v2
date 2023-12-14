/* special file. Whee. */
const {
  contextBridge,
  ipcRenderer,
  OpenDialogOptions
} = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  appClose: () => {
    ipcRenderer.send('app-close');
  },
  appMinimize: () => {
    ipcRenderer.send('app-minimize');
  },
  appMaximize: () => {
    ipcRenderer.send('app-maximize');
  },
  openFileDialog: (options /* OpenDialogOptions */) => {
    ipcRenderer.send('open-file-dialog', options);
  },
});


ipcRenderer.on('OPEN_FILE_SUCCESS', (e, msg) => {
  document.getElementById('react-root').dispatchEvent(
    new CustomEvent('OPEN_FILE_SUCCESS', {
    detail: { filePath: msg.payload }
  }));
});

ipcRenderer.on('OPEN_FILE_FAILURE', (e, msg) => {
  document.getElementById('react-root').dispatchEvent(
    new CustomEvent('OPEN_FILE_FAILURE', {
    detail: { filePath: msg.payload }
  }));
});
