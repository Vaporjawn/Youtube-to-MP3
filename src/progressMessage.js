const MESSAGES = {
    starting: 'Getting ready…',
    downloading: 'Downloading…',
    converting: 'Converting to MP3…',
    updating: 'YouTube changed, updating yt-dlp…',
    done: 'Conversion successful!'
};

/**
 * Text and bar fill for one progress update sent by the app.
 * A percent of null means the step has no measurable progress, so the bar shows motion instead.
 */
export function describeProgress(progress) {
    const percent = typeof progress.percent === 'number' ? progress.percent : null;
    return {
        message: MESSAGES[progress.stage] || MESSAGES.starting,
        percent,
        indeterminate: percent === null
    };
}
