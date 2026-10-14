/* special file. Whee. */
const {
  contextBridge,
  ipcRenderer,
  shell,
  OpenDialogOptions
} = require('electron');
const {fileURLToPath} = require('url');
const {watchSpriteFiles} = require('./watchSpriteFiles');

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
  showImageInFolder: async (imageUrl) => {
    shell.showItemInFolder(fileURLToPath(imageUrl));
  },
  watchSpriteFiles,
  onDevelopmentUpdate: (callback) => {
    const listener = (_event, available, restartRequired) => callback(available, restartRequired);
    ipcRenderer.on('dev-update', listener);
    ipcRenderer.send('dev-update-check');
    return () => ipcRenderer.removeListener('dev-update', listener);
  },
  reloadDevelopment: () => {
    ipcRenderer.send('dev-reload');
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

ipcRenderer.on('OPEN_FILE_CANCELLED', () => {
  document.getElementById('react-root').dispatchEvent(
    new CustomEvent('OPEN_FILE_CANCELLED'),
  );
});
