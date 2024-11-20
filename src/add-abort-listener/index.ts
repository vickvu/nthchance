import addAbortListener from '@SRC/add-abort-listener/impl';

export type AbortListener = (reason?: unknown) => void;
export type ClearAbortListener = () => void;
export type AddAbortListener = (signal: AbortSignal, listener: AbortListener) => ClearAbortListener;

export default addAbortListener;
