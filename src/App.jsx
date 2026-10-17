import React, {useCallback, useEffect, useRef, useState} from 'react';
import LinkInput from './components/LinkInput';
import ProgressBar from './components/ProgressBar';
import Finished from './components/Finished';
import Failed from './components/Failed';
import {describeProgress} from './progressMessage';

const FIRST_PROGRESS = {stage: 'starting', percent: null};

export default function App() {
    const [view, setView] = useState({name: 'idle'});
    const [progress, setProgress] = useState(FIRST_PROGRESS);
    const [title, setTitle] = useState('');
    const [settings, setSettings] = useState(null);
    const working = useRef(false);

    useEffect(() => {
        window.api.getSettings().then(setSettings);
        const stopSettings = window.api.onSettingsChanged(setSettings);
        const stopProgress = window.api.onProgress((update) => {
            if (update.title) setTitle(update.title);
            setProgress((previous) => ({...previous, ...update, percent: update.percent ?? null}));
        });
        return () => {
            stopSettings();
            stopProgress();
        };
    }, []);

    const start = useCallback(async (url) => {
        if (working.current) return;
        working.current = true;
        setTitle('');
        setProgress(FIRST_PROGRESS);
        setView({name: 'working'});
        const result = await window.api.startConversion(url);
        working.current = false;

        if (result.ok) {
            setView({name: 'done', filePath: result.filePath, title: result.title || title});
        } else if (result.error.code === 'cancelled') {
            setView({name: 'idle'});
        } else {
            setView({name: 'failed', error: result.error, url});
        }
    }, [title]);

    const reset = () => setView({name: 'idle'});

    return (
        <main className="screen">
            {view.name === 'idle' && <LinkInput onSubmit={start} settings={settings} />}
            {view.name === 'working' && (
                <ProgressBar
                    {...describeProgress(progress)}
                    title={title}
                    onCancel={() => window.api.cancelConversion()}
                />
            )}
            {view.name === 'done' && (
                <Finished
                    title={view.title}
                    onShow={() => window.api.showInFolder(view.filePath)}
                    onAnother={reset}
                    canShow={Boolean(view.filePath)}
                />
            )}
            {view.name === 'failed' && (
                <Failed error={view.error} onRetry={() => start(view.url)} onBack={reset} />
            )}
        </main>
    );
}
