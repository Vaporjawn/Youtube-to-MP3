'use strict';

const {BITRATES} = require('./settings');

const BITRATE_LABELS = {
    320: '320 kbps (Full Quality)',
    192: '192 kbps (High Quality)',
    160: '160 kbps (CD Quality)',
    130: '130 kbps (Radio Quality)',
    65: '65 kbps (Minimal Quality)'
};

/**
 * Builds the application menu template. Actions are passed in so this stays free of Electron imports.
 */
function buildMenuTemplate({appName, platform, isDevelopment, settings, actions}) {
    const isMac = platform === 'darwin';

    const preferences = {
        label: 'Preferences',
        submenu: [
            {label: 'Download Folder…', click: actions.chooseFolder},
            {label: 'Open Download Folder', click: actions.openFolder},
            {type: 'separator'},
            {
                label: 'Bitrate',
                submenu: BITRATES.map((bitrate) => ({
                    label: BITRATE_LABELS[bitrate],
                    type: 'radio',
                    checked: settings.bitrate === bitrate,
                    click: () => actions.setBitrate(bitrate)
                }))
            },
            {type: 'separator'},
            {label: 'Check for yt-dlp Updates…', click: actions.updateYtDlp}
        ]
    };

    const edit = {
        label: 'Edit',
        submenu: [
            {role: 'undo'},
            {role: 'redo'},
            {type: 'separator'},
            {role: 'cut'},
            {role: 'copy'},
            {role: 'paste'},
            {role: 'selectAll'}
        ]
    };

    const help = {
        label: 'Help',
        submenu: [
            {label: 'Project Page', click: () => actions.openExternal('https://github.com/Vaporjawn/Youtube-to-MP3')},
            {
                label: 'Report a Problem',
                click: () => actions.openExternal('https://github.com/Vaporjawn/Youtube-to-MP3/issues')
            }
        ]
    };

    const template = [];
    if (isMac) {
        template.push({
            label: appName,
            submenu: [
                {role: 'about'},
                {type: 'separator'},
                {role: 'hide'},
                {role: 'hideOthers'},
                {role: 'unhide'},
                {type: 'separator'},
                {role: 'quit'}
            ]
        });
    } else {
        template.push({label: 'File', submenu: [{role: 'quit'}]});
    }
    template.push(edit, preferences);

    if (isDevelopment) {
        template.push({label: 'View', submenu: [{role: 'reload'}, {role: 'toggleDevTools'}]});
    }
    if (isMac) {
        template.push({role: 'windowMenu'});
    }
    template.push(help);
    return template;
}

module.exports = {buildMenuTemplate, BITRATE_LABELS};
