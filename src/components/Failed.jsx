import React from 'react';

export default function Failed({error, onRetry, onBack}) {
    return (
        <div className="working">
            <p className="result__headline result__headline--error" role="alert">
                {error.message}
            </p>
            {error.detail && (
                <details className="result__details">
                    <summary>Details</summary>
                    <pre>{error.detail}</pre>
                </details>
            )}
            <div className="actions">
                <button className="button" type="button" onClick={onRetry}>
                    Try again
                </button>
                <button className="button button--quiet" type="button" onClick={onBack}>
                    Back
                </button>
            </div>
        </div>
    );
}
