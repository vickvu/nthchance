import fallbackAddAbortListener from '@SRC/add-abort-listener/fallback';
import type { AddAbortListener, AbortListener, ClearAbortListener } from '@SRC/add-abort-listener/index';
import type { EventEmitter as TypeEventEmitter } from 'node:stream';

let addAbortListenerImpl: AddAbortListener | undefined;

export default function addAbortListener(signal: AbortSignal, listener: AbortListener): ClearAbortListener {
    if (!addAbortListenerImpl) {
        try {
            // Try to use Node.js implementation if available
            /* eslint-disable-next-line @typescript-eslint/no-require-imports */
            const { EventEmitter } = require('node:events') as { EventEmitter: typeof TypeEventEmitter };
            addAbortListenerImpl = function (signal: AbortSignal, listener: AbortListener): ClearAbortListener {
                return EventEmitter.addAbortListener(signal, function () {
                    listener(signal.reason);
                })[Symbol.dispose];
            };
            /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
        } catch (err) {
            // Fallback implementation for browsers and older Node.js versions
            addAbortListenerImpl = fallbackAddAbortListener;
        }
    }
    return addAbortListenerImpl(signal, listener);
}
