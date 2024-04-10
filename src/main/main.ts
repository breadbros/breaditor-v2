import { dialog, BrowserWindow, ipcMain, app, session, OpenDialogOptions, Tray } from "electron";

import { setWindow } from "./renderer-window";
import { doInspectorSetupOnStart } from "./dev-mode";
import { setupTray } from "./tray";
import { createServer } from "./webserver";

const dotenv = require("dotenv").config();
const path = require("node:path");

let tray: Tray | null;

let server = createServer(22222);

let mainWindow: BrowserWindow;

app.on("ready", (event) => {
  mainWindow = new BrowserWindow({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      preload: path.join(__dirname, "preload_js.js"),
    },
  });
  
  mainWindow.setMenu(null); // No system menu.

  mainWindow.loadFile("dist/app/index.html"); // cwd is wherever you called `electron start` from.
  setWindow(mainWindow);

  doInspectorSetupOnStart();

  tray = setupTray();
  // Show the window when the tray icon is clicked
  if(tray)
  {
    tray.on("click", function () {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });
  }
  
  mainWindow.on("minimize", function (event) {
    event.preventDefault();
    mainWindow.hide();
  });

  if (dotenv.parsed && !dotenv.parsed.BREADITOR_DEV_MODE) {
    mainWindow.hide();
  }

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": ["unsafe-inline"], // "default-src 'self' *" //'unsafe-inline', ???
      },
    });
  });

  //////////////////////////////
  // From Tray
  ipcMain.on("set-title", (event, title) => {
    const webContents = event.sender;
    let win = BrowserWindow.fromWebContents(webContents) as any;
    (win as any).setTitle(title);
  });

  ipcMain.on("play-sound", (event, soundName) => {
    const webContents = event.sender;
    let win = BrowserWindow.fromWebContents(webContents) as any;
    (win as any).playSound(soundName);
  });

  ipcMain.on("say-words", (event, text: string) => {
    if (text.length == 0) {
      return;
    }

    if (text.length > 255) {
      text = text.substring(0, 255);
    }

    const webContents = event.sender;
    let win = BrowserWindow.fromWebContents(webContents) as any;
    (win as any).sayWords(text);
  });
  // From Tray
  //////////////////////////////////////
  // From Breaditor
  ipcMain.on('app-minimize', () => {
    console.log('app-minimize');
    mainWindow.minimize();
  });
  ipcMain.on('app-maximize', () => {
    console.log('app-maximize');
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('app-close', () => {
    mainWindow.close();
  });

  ipcMain.on('open-file-dialog', (event: Electron.IpcMainEvent, arg: any[]) => {
    const options: OpenDialogOptions = arg[0];
    const senderWebContents = event.sender;

    dialog
      .showOpenDialog(options)
      .then((result) => {
        if (!result.canceled && result.filePaths.length > 0) {
          const filePath = result.filePaths[0];

          senderWebContents.send('OPEN_FILE_SUCCESS', { type: 'OPEN_FILE_SUCCESS', payload: filePath });
        }
      })
      .catch((error) => {
        senderWebContents.send('OPEN_FILE_FAILURE', { type: 'OPEN_FILE_FAILURE', payload: error });
      });
  });
  mainWindow.on('closed', function () {
    if (process.platform !== 'darwin') app.quit();
  });

});
