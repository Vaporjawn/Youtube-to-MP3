'use strict';

const {contextBridge, ipcRenderer} = require('electron');

/**
 * The only things the page can ask the app to do. Everything is validated again in the main process.
 */
contextBridge.exposeInMainWorld('api', {
    getInfo: () => ipcRenderer.invoke('app:info'),
    getSettings: () => ipcRenderer.invoke('settings:get'),
    startConversion: (url) => ipcRenderer.invoke('convert:start', url),
    cancelConversion: () => ipcRenderer.send('convert:cancel'),
    showInFolder: (filePath) => ipcRenderer.invoke('file:reveal', filePath),
    onProgress(callback) {
        const listener = (event, progress) => callback(progress);
        ipcRenderer.on('convert:progress', listener);
        return () => ipcRenderer.removeListener('convert:progress', listener);
    },
    onSettingsChanged(callback) {
        const listener = (event, settings) => callback(settings);
        ipcRenderer.on('settings:changed', listener);
        return () => ipcRenderer.removeListener('settings:changed', listener);
    }
});
