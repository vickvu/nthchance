import type { AbortListener, ClearAbortListener } from '@SRC/add-abort-listener/index';

export default function (signal: AbortSignal, listener: AbortListener): ClearAbortListener {
    const handler = function () {
        listener(signal.reason);
    };
    signal.addEventListener('abort', handler);
    return function () {
        signal.removeEventListener('abort', handler);
    };
}
