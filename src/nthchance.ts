import addAbortListener from '@SRC/add-abort-listener/index';

/**
 * A base execution record.
 */
export interface BaseExcutionRecord<TArgs extends readonly unknown[] = unknown[], TRetVal = unknown> {
    /**
     * The arguments passed to the function.
     */
    args: TArgs;
    /**
     * The high-resolution start time of the execution in nanoseconds.
     */
    startTime: bigint;
    /**
     * The high-resolution finish time of the execution in nanoseconds.
     */
    finishTime: bigint;
    /**
     * The decision made by the {@link Decider}.
     */
    decision?: DeciderOutcome<TArgs, TRetVal>;
    /**
     *  Whether the execution was aborted.
     */
    aborted?: boolean;
    /**
     * The reason for abortion, if any.
     */
    abortReason?: unknown;
}

/**
 * An failed {@link BaseExcutionRecord}.
 */
export interface FailedExecution<TArgs extends readonly unknown[] = unknown[], TRetVal = unknown> extends BaseExcutionRecord<TArgs, TRetVal> {
    /**
     * Error.
     */
    error: unknown;
}
function isFailedExecution<TArgs extends readonly unknown[] = unknown[], TRetVal = unknown>(exec: ExecutionRecord<TArgs, TRetVal>): exec is FailedExecution<TArgs, TRetVal> {
    return (<FailedExecution<TArgs, TRetVal>>exec).error != null;
}

/**
 * A successful {@link BaseExcutionRecord}.
 */
export interface SuccesfulExecution<TArgs extends readonly unknown[] = unknown[], TRetVal = unknown> extends BaseExcutionRecord<TArgs, TRetVal> {
    /**
     * Returned value.
     */
    returnedValue: Awaited<TRetVal>;
}

/**
/**
 * Represents an execution record, which can be either {@link SuccesfulExecution} or {@link FailedExecution}.
 * 
 * @template TArgs - The type of the arguments passed to the function.
 * @template TRetVal - The type of the return value of the function.
 */
export type ExecutionRecord<TArgs extends readonly unknown[] = unknown[], TRetVal = unknown> = SuccesfulExecution<TArgs, TRetVal> | FailedExecution<TArgs, TRetVal>;

/**
 * The decision made by the {@link Decider} to try again.
 */
export interface TryAgainDecision<TArgs extends readonly unknown[] = unknown[]> {
    /**
     * Should retry.
     */
    retry: true;
    /**
     * The delay between retry, in millisecond.
     */
    delay?: number;
    /**
     * Arguments to passed to the next retry.
     */
    args?: TArgs;
}
function isTryAgain<TArgs extends readonly unknown[] = unknown[], TRetVal = unknown>(decision: DeciderOutcome<TArgs, TRetVal>): decision is TryAgainDecision<TArgs> {
    return decision.retry;
}

/**
 *  The decision made by the {@link Decider} to stop.
 */
export interface StopDecision {
    /**
     * Do not retry.
     */
    retry: false;
    /**
     * The error to be returned to the caller in a rejected promise.
     */
    error: unknown;
}
function isStop<TArgs extends readonly unknown[] = unknown[], TRetVal = unknown>(decision: DeciderOutcome<TArgs, TRetVal>): decision is StopDecision {
    return (<StopDecision>decision).error != null;
}

/**
 * The decision made by the {@link Decider} to return successfully.
 */
export interface ReturnDecision<TRetVal = unknown> {
    /**
     * Do not retry.
     */
    retry: false;
    /**
     * The value to be returned to the caller in a resolved promise.
     */
    returnedValue: Awaited<TRetVal>;
}

/**
/**
 * The outcome of a decision made by the {@link Decider} which could be:
 *  - {@link TryAgainDecision}: Try again.
 *  - {@link StopDecision}: Stop.
 *  - {@link ReturnDecision}: Return the value.
 * 
 * @template TArgs - The type of the arguments passed to the function.
 * @template TRetVal - The type of the return value of the function.
 */
export type DeciderOutcome<TArgs extends readonly unknown[] = unknown[], TRetVal = unknown> = TryAgainDecision<TArgs> | StopDecision | ReturnDecision<TRetVal>;

/**
 * The `Decider` type represents a function that determines the outcome of a retry attempt.
 *
 * @template TArgs - The type of the arguments passed to the main function.
 * @template TRetVal - The type of the return value of the main function.
 *
 * @param {NthChanceFunction<TArgs, TRetVal>} fn - The retryable function.
 * @returns {Promise<DeciderOutcome<TArgs, TRetVal>> | DeciderOutcome<TArgs, TRetVal>} - The outcome of the retry attempt.
 */
export type Decider<TArgs extends readonly unknown[] = unknown[], TRetVal = unknown> = (
    fn: NthChanceFunction<TArgs, TRetVal>,
) => Promise<DeciderOutcome<TArgs, TRetVal>> | DeciderOutcome<TArgs, TRetVal>;

/**
 * The function to be wrapped around.
 */
export interface MainFunction<TArgs extends readonly unknown[] = unknown[], TRetVal = unknown> {
    (...args: TArgs): TRetVal;
}

type EnsurePromise<T> = Promise<Awaited<T>>;

/**
 * A function that can be retried multiple times based on the provided options.
 *
 * @template TArgs - The type of the arguments passed to the main function.
 * @template TRetVal - The type of the return value of the main function.
 *
 * @param {...TArgs} args - The arguments to pass to the main function.
 * @returns {EnsurePromise<TRetVal>} - A promise that resolves with the return value of the main function.
 */
export interface NthChanceFunction<TArgs extends readonly unknown[] = unknown[], TRetVal = unknown> {
    /**
     * An array of execution details for each retry attempt.
     */
    executions: ExecutionRecord<TArgs, TRetVal>[];
    /**
     *  Abort the retry process.
     * @param reason - Reason to abort.
     */
    abort(reason?: unknown): void;
    (...args: TArgs): EnsurePromise<TRetVal>;
}

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
    return value !== null && typeof value === 'object' && typeof (<PromiseLike<T>>value).then === 'function';
}

/**
 * Options for the nthchance
 */
export interface NthChanceOptions {
    /**
     * The total number of retries
     * @default 2
     */
    retries?: number;

    /**
     * The maximum time to delay in millisecond
     * @default 10,000 (10 seconds)
     */
    maxDelay?: number;

    /**
     * The factor by which the delay time is increased by a factor of 2 between the end of a failed execution and the start of the next retry attempt.
     * For example, if `delayMultiplier` is 1000, then the delay would be 1000, 2000, 4000, 8000.
     * The maximum delay is capped by `maxDelay` and `totalTimeout`.
     * @default 1000 (1 second)
     */
    delayMultiplier?: number;

    /**
     * The maximum number of millisecond to be added to the delay to introduce some randomness
     * @default 0
     */
    maxDelayVariation?: number;

    /**
     * The totaltime to keep retrying in millisecond.
     * The last sleep period will be shortened as necessary, so that the last retry runs at deadline (and not considerably beyond it).
     * The total time starting from when the initial execution is done, after which an error will be returned, regardless of the retrying attempts made meanwhile.
     * @default 30,000 (30 seconds)
     */
    totalTimeout?: number;

    /**
     * The signal to abort the retry
     */
    signal?: AbortSignal;
}

const NANOSECONDS_PER_MILLISECOND = 1000000n;

/**
 * Calculates the delay before the next retry attempt.
 *
 * @param {number} totalExecTime - The total execution time so far in milliseconds.
 * @param {number} execCount - The number of execution attempts made so far.
 * @param {NthChanceOptions} options - The options to configure the retry behavior.
 * @returns {number | undefined} - The delay in milliseconds before the next retry attempt, or undefined if no more retries should be made.
 */
export function getDelay(totalExecTime: number, execCount: number, { totalTimeout = 30000, retries = 2, maxDelay = 10000, delayMultiplier = 1000, maxDelayVariation = 0 }: NthChanceOptions) {
    const maxAllowableDelay = Math.floor(totalTimeout - totalExecTime - totalExecTime / execCount);
    if (maxAllowableDelay > 0 && execCount <= retries) {
        return Math.min(Math.pow(2, execCount - 1) * delayMultiplier + Math.floor(Math.random() * maxDelayVariation), maxDelay, maxAllowableDelay);
    }
    return undefined;
}
/**
 * Generates a decider function based on the provided options.
 * The decider function determines whether to retry the operation and how long to wait before retrying.
 *
 * @param {NthChanceOptions} opts - The options to configure the retry behavior.
 * @returns A decider function that decides whether to retry and the delay before the next retry.
 */
export function generateDeciderFromOptions<TArgs extends readonly unknown[] = unknown[], TRetVal = unknown>(opts: NthChanceOptions): Decider<TArgs, TRetVal> {
    return function (fn: NthChanceFunction<TArgs, TRetVal>) {
        const lastExec = fn.executions[fn.executions.length - 1];
        if (isFailedExecution(lastExec)) {
            let totalExecTime: bigint = 0n;
            fn.executions.forEach(function (exec) {
                totalExecTime += exec.finishTime - exec.startTime;
            });
            const delay = getDelay(Number(totalExecTime / NANOSECONDS_PER_MILLISECOND), fn.executions.length, opts);
            if (delay != null) {
                return {
                    retry: true,
                    delay,
                };
            }
            return {
                retry: false,
                error: lastExec.error,
            };
        }
        return {
            retry: false,
            returnedValue: lastExec.returnedValue,
        };
    };
}

/**
 * The `NthChance` class provides a way to execute a function with automatic retries.
 *
 * @template TArgs - The type of the arguments passed to the function.
 * @template TRetVal - The type of the return value of the function.
 *
 * @example
 * const retryableFunction = new NthChance(exampleFunction).with({
 *     totalTimeout: 30000,
 *     retries: 5,
 *     delayMultiplier: 1000,
 *     maxDelay: 5000,
 *     maxDelayVariation: 1000,
 * });
 *
 * retryableFunction().then(result => {
 *     console.log('Function succeeded with result:', result);
 * }).catch(error => {
 *     console.error('Function failed with error:', error);
 * });
 */
export class NthChance<TArgs extends readonly unknown[] = unknown[], TRetVal = unknown> {
    #fn: MainFunction<TArgs, TRetVal>;

    constructor(fn: MainFunction<TArgs, TRetVal>) {
        this.#fn = fn;
    }

    /**
     * Configures the retry behaviour using the provided options.
     *
     * @param {NthChanceOptions} opts - The options to configure the retry behaviour.
     * @returns {NthChanceFunction<TArgs, TRetVal>} A retryable function with the configured behaviour.
     */
    with(opts: NthChanceOptions): NthChanceFunction<TArgs, TRetVal>;
    /**
     *  Configures the retry behaviour using the provided options or a custom decider function.
     *
     * @param { Decider<TArgs, TRetVal>} decider - A custom {@link Decider} function.
     * @param {AbortSignal} signal - An optional {@link AbortSignal} to abort the retry process.
     * @returns {NthChanceFunction<TArgs, TRetVal>} A retryable function with the configured behaviour.
     */
    with(decider: Decider<TArgs, TRetVal>, signal?: AbortSignal): NthChanceFunction<TArgs, TRetVal>;
    with(arg1: NthChanceOptions | Decider<TArgs, TRetVal>, arg2?: AbortSignal): NthChanceFunction<TArgs, TRetVal> {
        let decider: Decider<TArgs, TRetVal>;
        let signal: AbortSignal | undefined;
        if (typeof arg1 === 'function') {
            decider = arg1;
            signal = arg2;
        } else {
            decider = generateDeciderFromOptions(arg1);
            signal = arg1.signal;
        }
        const fn = this.#fn;
        const retVal: NthChanceFunction<TArgs, TRetVal> = <NthChanceFunction<TArgs, TRetVal>>function async(...originalArgs: TArgs): EnsurePromise<TRetVal> {
            let clearAbortListener: VoidFunction;
            let aborted: boolean | undefined;
            let abortReason: unknown;
            const abort = function (reason?: unknown) {
                aborted = true;
                abortReason = reason;
                clearAbortListener();
                if (timeoutHandler) {
                    // Clear the timeout so the next run won't be executed
                    clearTimeout(timeoutHandler);
                    const lastExec = retVal.executions[retVal.executions.length - 1];
                    lastExec.aborted = true;
                    lastExec.abortReason = abortReason;
                }
                if (reason) {
                    if (typeof reason === 'string') {
                        rejectFunc(`Aborted: ${reason}`);
                    } else {
                        rejectFunc(reason);
                    }
                } else {
                    rejectFunc(new Error('Aborted'));
                }
            };
            if (signal) {
                signal.throwIfAborted();
                clearAbortListener = addAbortListener(signal, abort);
            } else {
                clearAbortListener = function () {};
            }
            retVal.abort = abort;
            let resolveFunc: (value: Awaited<TRetVal>) => void;
            let rejectFunc: (reason: unknown) => void;
            let startTime: bigint;
            let finishTime: bigint;
            let timeoutHandler: NodeJS.Timeout | undefined;
            function processDecision(execution: ExecutionRecord<TArgs, TRetVal>, decision: DeciderOutcome<TArgs, TRetVal>) {
                execution.decision = decision;
                if (aborted) {
                    execution.aborted = true;
                    execution.abortReason = abortReason;
                    return;
                }
                if (isTryAgain(decision)) {
                    timeoutHandler = setTimeout(run.bind(null, decision.args ?? originalArgs), decision.delay ? decision.delay : 0);
                } else if (isStop(decision)) {
                    rejectFunc(decision.error);
                } else {
                    resolveFunc(decision.returnedValue);
                }
            }
            function decide(execution: ExecutionRecord<TArgs, TRetVal>) {
                retVal.executions.push(execution);
                if (aborted) {
                    execution.aborted = true;
                    execution.abortReason = abortReason;
                    return;
                }
                try {
                    const decision = decider.apply(null, [retVal]);
                    if (isPromiseLike(decision)) {
                        decision.then(
                            function (decision) {
                                processDecision(execution, decision);
                            },
                            function (err: unknown) {
                                // Unexpected reject from the decider
                                // Immediately reject without further processing
                                rejectFunc(err);
                            },
                        );
                    } else {
                        processDecision(execution, decision);
                    }
                } catch (err) {
                    // Unexpected error from the decider or them the .then function
                    // Immediately reject without further processing
                    rejectFunc(err);
                }
            }
            function run(args: TArgs) {
                // Clear the timeoutHandler
                timeoutHandler = undefined;
                // This condition should never be true, but we still keep this check to avoid bugs
                /* c8 ignore start */
                if (aborted) {
                    return;
                }
                /* c8 ignore end */
                let retVal: TRetVal;
                try {
                    startTime = process.hrtime.bigint();
                    retVal = fn(...args);
                    finishTime = process.hrtime.bigint();
                } catch (err: unknown) {
                    finishTime = process.hrtime.bigint();
                    decide({
                        args,
                        startTime,
                        finishTime,
                        error: err,
                    });
                    return;
                }
                if (isPromiseLike<Awaited<TRetVal>>(retVal)) {
                    try {
                        retVal.then(
                            function (awaitedRetVal) {
                                decide({
                                    args,
                                    startTime,
                                    finishTime,
                                    returnedValue: awaitedRetVal,
                                });
                            },
                            function (err: unknown) {
                                decide({
                                    args,
                                    startTime,
                                    finishTime,
                                    error: err,
                                });
                            },
                        );
                    } catch (err) {
                        // Undpected error from the .then function
                        // Immediately reject without further processing
                        rejectFunc(err);
                    }
                    return;
                }
                decide({
                    args,
                    startTime,
                    finishTime,
                    returnedValue: <Awaited<TRetVal>>retVal,
                });
            }
            return new Promise<Awaited<TRetVal>>((resolve, reject) => {
                resolveFunc = resolve;
                rejectFunc = reject;
                run(originalArgs);
            });
        };
        retVal.abort = function () {};
        retVal.executions = [];
        return retVal;
    }
}
