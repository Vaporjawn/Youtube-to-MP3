import React from 'react';

export default function ProgressBar({message, percent, indeterminate, title, onCancel}) {
    return (
        <div className="working">
            <div
                className="progress"
                role="progressbar"
                aria-label={message}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={indeterminate ? undefined : percent}
            >
                {indeterminate ? (
                    <div key="busy" className="progress__bar progress__bar--busy" />
                ) : (
                    <div key="measured" className="progress__bar" style={{width: `${percent}%`}} />
                )}
                {!indeterminate && <div className="progress__percentage">{percent}%</div>}
            </div>
            <p className="progress__info" aria-live="polite">
                {message}
            </p>
            {title && <p className="progress__title">{title}</p>}
            <button className="button button--quiet" type="button" onClick={onCancel}>
                Cancel
            </button>
        </div>
    );
}
