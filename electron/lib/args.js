'use strict';

/**
 * Builds the yt-dlp argument list for one conversion.
 * The address always comes after "--" so it can never be read as an option.
 */
function buildArgs({url, bitrate, downloadFolder, tempFolder, ffmpegPath}) {
    return [
        '--ignore-config',
        '--no-playlist',
        '--quiet',
        '--progress',
        '--newline',
        '--color',
        'never',
        '-f',
        'bestaudio/best',
        '-x',
        '--audio-format',
        'mp3',
        '--audio-quality',
        `${bitrate}K`,
        '--embed-metadata',
        '--windows-filenames',
        '--trim-filenames',
        '180',
        '--ffmpeg-location',
        ffmpegPath,
        '-P',
        `home:${downloadFolder}`,
        '-P',
        `temp:${tempFolder}`,
        '-o',
        '%(title)s.%(ext)s',
        '--progress-template',
        'download:PROGRESS|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s',
        '--progress-template',
        'postprocess:PP|%(progress.status)s|%(progress.postprocessor)s',
        '--print',
        'before_dl:TITLE|%(title)s',
        '--print',
        'after_move:FILE|%(filepath)s',
        '--',
        url
    ];
}

module.exports = {buildArgs};
