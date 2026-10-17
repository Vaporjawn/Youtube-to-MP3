import React from 'react';

export default function Finished({title, onShow, onAnother, canShow}) {
    return (
        <div className="working">
            <p className="result__headline" role="status">
                Conversion successful!
            </p>
            {title && <p className="progress__title">{title}</p>}
            <div className="actions">
                {canShow && (
                    <button className="button" type="button" onClick={onShow}>
                        Show in folder
                    </button>
                )}
                <button className="button button--quiet" type="button" onClick={onAnother}>
                    Convert another
                </button>
            </div>
        </div>
    );
}
