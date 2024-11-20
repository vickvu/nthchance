import type EventEmitter from 'node:events';
import { isNode } from 'browser-or-node';
import fallbackAddAbortListener from '@SRC/add-abort-listener/fallback';
import type { AddAbortListener, AbortListener, ClearAbortListener } from '@SRC/add-abort-listener/index';

let nodeAddAbortListener: typeof EventEmitter.addAbortListener | undefined;

if (isNode) {
    try {
        // Try to use Node.js implementation if available
        const { EventEmitter } = await import('node:events');
        /* eslint-disable-next-line @typescript-eslint/unbound-method */
        nodeAddAbortListener = EventEmitter.addAbortListener;
        /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    } catch (err) {
        nodeAddAbortListener = undefined;
    }
}

let addAbortListenerImpl: AddAbortListener | undefined;

export default function addAbortListener(signal: AbortSignal, listener: AbortListener): ClearAbortListener {
    if (!addAbortListenerImpl) {
        if (nodeAddAbortListener) {
            addAbortListenerImpl = function (signal: AbortSignal, listener: AbortListener): ClearAbortListener {
                return nodeAddAbortListener(signal, function () {
                    listener(signal.reason);
                })[Symbol.dispose];
            };
        } else {
            // Fallback implementation for browsers and older Node.js versions
            addAbortListenerImpl = fallbackAddAbortListener;
        }
    }
    return addAbortListenerImpl(signal, listener);
}
