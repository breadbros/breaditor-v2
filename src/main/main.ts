import {
  BrowserWindow,
  app,
  ipcMain,
  session,
  OpenDialogOptions,
} from 'electron';
import {dialog} from 'electron';
/*import {
  default as installExtension,
  REACT_DEVELOPER_TOOLS,
  JQUERY_DEBUGGER,
  REDUX_DEVTOOLS,
} from 'electron-devtools-installer';
*/
import path from 'path';

const dotenv = require('dotenv').config();

let mainWindow: BrowserWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    frame: false, // no title bar
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      preload: path.join(__dirname, '../app/', 'preload.js'), // for all those main/renderer bridge things
      // enableRemoteModule: true,
    },
  });
  mainWindow.setMenu(null); // No system menu.
  mainWindow.loadFile('dist/app/index.html'); // cwd is wherever you called `electron start` from.

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [''], // "default-src 'self' *" //'unsafe-inline', ???
      },
    });
  });

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

  ipcMain.on('open-file-dialog', (_options: any) => {
    const options: OpenDialogOptions = _options;

    console.log('MAIN open-file-dialog');
    dialog
      .showOpenDialog(options)
      .then((result) => {
        if (!result.canceled && result.filePaths.length > 0) {
          const filePath = result.filePaths[0];
          console.log('filePath', filePath);
          //dispatch({type: 'OPEN_FILE_SUCCESS', payload: filePath});
        }
      })
      .catch((error) => {
        console.log('error', error);
        //dispatch({type: 'OPEN_FILE_FAILURE', payload: error});
      });
  });

  mainWindow.on('closed', function () {
    if (process.platform !== 'darwin') app.quit();
  });

  if (dotenv.parsed.BREADITOR_DEV_MODE) {
    const devtoolsWindow = new BrowserWindow();
    mainWindow.webContents.setDevToolsWebContents(devtoolsWindow.webContents);
    mainWindow.webContents.openDevTools({mode: 'detach'});

    // Set the devtools position when the parent window has finished loading.
    mainWindow.webContents.once('did-finish-load', function () {
      console.log('Main window did-finish-load.');

      if (
        dotenv.parsed.MAIN_WINDOW_X != undefined &&
        dotenv.parsed.MAIN_WINDOW_Y != undefined &&
        dotenv.parsed.MAIN_WINDOW_W != undefined &&
        dotenv.parsed.MAIN_WINDOW_H != undefined
      ) {
        console.log('Main window set size.');

        const x = parseInt(dotenv.parsed.MAIN_WINDOW_X, 10);
        const y = parseInt(dotenv.parsed.MAIN_WINDOW_Y, 10);
        const w = parseInt(dotenv.parsed.MAIN_WINDOW_W, 10);
        const h = parseInt(dotenv.parsed.MAIN_WINDOW_H, 10);

        mainWindow.setPosition(x, y);
        mainWindow.setSize(w, h);
      }
    });

    devtoolsWindow.webContents.once('did-finish-load', function () {
      console.log('devtoolsWindow did-finish-load.');
      if (
        dotenv.parsed.INSPECTOR_WINDOW_X != undefined &&
        dotenv.parsed.INSPECTOR_WINDOW_Y != undefined &&
        dotenv.parsed.INSPECTOR_WINDOW_W != undefined &&
        dotenv.parsed.INSPECTOR_WINDOW_H != undefined
      ) {
        console.log('devtoolsWindow set size.');

        const x = parseInt(dotenv.parsed.INSPECTOR_WINDOW_X, 10);
        const y = parseInt(dotenv.parsed.INSPECTOR_WINDOW_Y, 10);
        const w = parseInt(dotenv.parsed.INSPECTOR_WINDOW_W, 10);
        const h = parseInt(dotenv.parsed.INSPECTOR_WINDOW_H, 10);

        devtoolsWindow.setPosition(x, y);
        devtoolsWindow.setSize(w, h);
      }
    });

    console.log('Lol, Development.');
  } else {
    console.log('Lol, Production.');
  }
}

// Currently broken?  wtf
// app.whenReady().then(() => {
//   installExtension([REACT_DEVELOPER_TOOLS, JQUERY_DEBUGGER, REDUX_DEVTOOLS])
//     .then((name) => console.log(`Added Extension:  ${name}`))
//     .catch((err) => console.log('An error occurred: ', err));
// });

app.on('ready', async () => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
