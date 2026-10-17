import React, {useState} from 'react';

const WATCH_URL = /^(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be)\//i;

/**
 * Quick check so an obviously wrong paste is caught in the page. The app checks again before using it.
 */
export function looksLikeYouTubeLink(text) {
    return WATCH_URL.test(text.trim());
}

export default function LinkInput({onSubmit, settings}) {
    const [value, setValue] = useState('');
    const [showError, setShowError] = useState(false);

    const submit = (event) => {
        event.preventDefault();
        if (!looksLikeYouTubeLink(value)) {
            setShowError(true);
            return;
        }
        onSubmit(value.trim());
    };

    return (
        <form className="link" onSubmit={submit} noValidate>
            <input
                className={`link__input${showError ? ' link__input--error' : ''}`}
                aria-label="YouTube video link"
                aria-invalid={showError}
                aria-describedby={showError ? 'link-error' : undefined}
                value={value}
                onChange={(event) => {
                    setValue(event.target.value);
                    setShowError(false);
                }}
                placeholder="https://www.youtube.com/watch?v=zmXUWKwxDg4"
                autoFocus
                spellCheck={false}
            />
            {showError && (
                <p id="link-error" className="link__error" role="alert">
                    Paste the link to a single YouTube video.
                </p>
            )}
            <button className="button" type="submit">
                Convert to .mp3
            </button>
            {settings && (
                <p className="link__settings" title={settings.downloadFolder}>
                    {settings.bitrate} kbps · saving to {settings.downloadFolder}
                </p>
            )}
            <p className="link__note">Only convert videos you have the right to download.</p>
        </form>
    );
}
