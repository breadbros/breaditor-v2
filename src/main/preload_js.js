const { contextBridge, ipcRenderer } = require("electron/renderer");
const { OpenDialogOptions } = require("electron");

/* from the tray project */
contextBridge.exposeInMainWorld("ipcComms", {
  // send's go to the main process
  setTitle: (title) => ipcRenderer.send("set-title", title),
  playSound: (id) => ipcRenderer.send("play-sound", id),

  // on's come from the main process
  onShowAlert: (callback) =>
    ipcRenderer.on("show-alert", (_event, value) => callback(value)),
  onRefreshPage: (callback) =>
    ipcRenderer.on("refresh-page", (_event, value) => callback(value)),
  onPlaySound: (callback) =>
    ipcRenderer.on("play-sound", (_event, value) => callback(value)),
  onSayWords: (callback) =>
    ipcRenderer.on("say-words", (_event, value) => callback(value)),
});

/* from the mapeditor */
contextBridge.exposeInMainWorld("electronAPI", {
  appClose: () => {
    ipcRenderer.send("app-close");
  },
  appMinimize: () => {
    ipcRenderer.send("app-minimize");
  },
  appMaximize: () => {
    ipcRenderer.send("app-maximize");
  },
  openFileDialog: (options /* OpenDialogOptions */) => {
    ipcRenderer.send("open-file-dialog", options);
  },
});

ipcRenderer.on("OPEN_FILE_SUCCESS", (e, msg) => {
  document.getElementById("react-root").dispatchEvent(
    new CustomEvent("OPEN_FILE_SUCCESS", {
      detail: { filePath: msg.payload },
    }),
  );
});

ipcRenderer.on("OPEN_FILE_FAILURE", (e, msg) => {
  document.getElementById("react-root").dispatchEvent(
    new CustomEvent("OPEN_FILE_FAILURE", {
      detail: { filePath: msg.payload },
    }),
  );
});
