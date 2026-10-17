'use strict';

const {app, BrowserWindow, Menu, dialog, ipcMain, session, shell} = require('electron');
const path = require('path');
const {pathToFileURL} = require('url');

const {bundledBinDir, createBinaries} = require('./lib/binaries');
const {createConverter} = require('./lib/converter');
const {createUpdater} = require('./lib/updater');
const {createSettingsStore} = require('./lib/settings');
const {buildMenuTemplate} = require('./lib/menu');

const PAGE = path.join(__dirname, '..', 'app', 'index.html');
const PAGE_PATHNAME = pathToFileURL(PAGE).pathname;
const isDevelopment = !app.isPackaged;

let mainWindow = null;
let lastConvertedFile = null;

function sendToWindow(channel, payload) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function isFromOurPage(event) {
    const url = event.senderFrame && event.senderFrame.url;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'file:' && parsed.pathname === PAGE_PATHNAME;
    } catch (e) {
        return false;
    }
}

function start() {
    const settings = createSettingsStore(path.join(app.getPath('userData'), 'settings.json'), app.getPath('downloads'));
    const binaries = createBinaries({
        bundledDir: bundledBinDir({
            isPackaged: app.isPackaged,
            resourcesPath: process.resourcesPath,
            projectRoot: path.join(__dirname, '..')
        }),
        userDir: path.join(app.getPath('userData'), 'bin')
    });
    const updater = createUpdater({binaries});
    const converter = createConverter({binaries, updater, emit: (progress) => sendToWindow('convert:progress', progress)});

    function rebuildMenu() {
        const actions = {
            chooseFolder,
            openFolder: () => shell.openPath(settings.get().downloadFolder),
            setBitrate(bitrate) {
                settings.update({bitrate});
                sendToWindow('settings:changed', settings.get());
                rebuildMenu();
            },
            updateYtDlp,
            openExternal: (url) => shell.openExternal(url)
        };
        Menu.setApplicationMenu(
            Menu.buildFromTemplate(
                buildMenuTemplate({
                    appName: app.name,
                    platform: process.platform,
                    isDevelopment,
                    settings: settings.get(),
                    actions
                })
            )
        );
    }

    async function chooseFolder() {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Select the folder to save MP3 files in',
            defaultPath: settings.get().downloadFolder,
            properties: ['openDirectory', 'createDirectory']
        });
        if (result.canceled || result.filePaths.length === 0) return;
        settings.update({downloadFolder: result.filePaths[0]});
        sendToWindow('settings:changed', settings.get());
    }

    async function updateYtDlp() {
        const outcome = await updater.update();
        dialog.showMessageBox(mainWindow, {
            type: outcome.ok ? 'info' : 'warning',
            message: outcome.message,
            detail: outcome.ok ? '' : 'Check your internet connection and try again.'
        });
    }

    ipcMain.handle('app:info', (event) => (isFromOurPage(event) ? {name: app.name, version: app.getVersion()} : null));

    ipcMain.handle('settings:get', (event) => (isFromOurPage(event) ? settings.get() : null));

    ipcMain.handle('convert:start', async (event, url) => {
        if (!isFromOurPage(event)) return {ok: false, error: {code: 'forbidden', message: 'Not allowed.'}};
        const {bitrate, downloadFolder} = settings.get();
        const result = await converter.convert({url, bitrate, downloadFolder});
        if (result.ok) lastConvertedFile = result.filePath;
        return result;
    });

    ipcMain.on('convert:cancel', (event) => {
        if (isFromOurPage(event)) converter.cancel();
    });

    ipcMain.handle('file:reveal', (event, filePath) => {
        // Only the file this app just produced can be revealed, never an arbitrary path from the page.
        if (isFromOurPage(event) && filePath && filePath === lastConvertedFile) shell.showItemInFolder(filePath);
    });

    rebuildMenu();

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 640,
        minHeight: 460,
        title: 'YouTube To MP3',
        // macOS takes the icon from the app bundle; Windows and Linux windows need it set here.
        icon: process.platform === 'darwin' ? undefined : path.join(__dirname, '..', 'build', 'icon.png'),
        backgroundColor: '#9abdeb',
        // Automated tests set this so no window appears on screen.
        show: process.env.YOUTUBE_TO_MP3_HIDDEN !== '1',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true
        }
    });
    mainWindow.loadFile(PAGE);
    mainWindow.on('closed', () => {
        converter.cancel();
        mainWindow = null;
    });
}

app.on('web-contents-created', (event, contents) => {
    contents.setWindowOpenHandler(() => ({action: 'deny'}));
    contents.on('will-navigate', (navigation) => navigation.preventDefault());
});

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => callback(false));
        start();
    });

    app.on('window-all-closed', () => app.quit());
}
