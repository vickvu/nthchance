# Nth Chance

[![Build Status](https://github.com/vickvu/nthchance/actions/workflows/main.yml/badge.svg)](https://github.com/vickvu/nthchance/actions/workflows/main.yml)
[![Publish Status](https://github.com/vickvu/nthchance/actions/workflows/publish.yml/badge.svg)](https://github.com/vickvu/nthchance/actions/workflows/publish.yml)

[![npm](https://img.shields.io/npm/v/nthchance)](https://www.npmjs.com/package/nthchance)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

nthchance provides a friendly way to execute an action with automatic retries. If your function fails, it will keep trying until it succeeds or the retry limit is reached.

## Quick start

### Installation

```bash
npm install nthchance
```

### Usage

```typescript
import nthchance from 'nthchance';

// Example function to demonstrate retry mechanism
async function exampleFunction() {
    // Simulate a function that may fail
    const random = Math.random();
    if (random < 0.7) {
        throw new Error('Random failure');
    }
    return 'Success';
}

// Create an instance of NthChance with the example function
const retryableFunction = nthchance(exampleFunction).with({
    totalTimeout: 30000, // Total timeout of 30 seconds
    retries: 5, // Maximum number of retries
    delayMultiplier: 1000, // Initial delay of 1 second
    maxDelay: 5000, // Maximum delay of 5 seconds
    maxDelayVariation: 1000, // Random variation in delay up to 1 second
});

// Execute the retryable function
retryableFunction()
    .then((result) => {
        console.log('Function succeeded with result:', result);
    })
    .catch((error) => {
        console.error('Function failed with error:', error);
    });
```

## API Guide

### nthchance function

The default `nthchance` function is used to create a retryable function from existing function.

-   `nthchance(fn).with(opts)`: Create a retryable function with the provided function `fn` and options `opts`.
-   `nthchance(fn).with(d)`: Create a retryable function with the provided function `fn` and decider `d`.
-   `nthchance(fn).with(d, as)`: Create a retryable function with the provided function `fn` and decider `d` and [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) `as`.

### NthChanceFunction

The result from `nthchance(fn).with(...)` call is a retryable function of the type `NthChanceFunction`. It provides additional properties and methods to control and monitor the retry process:

-   `executions`: An array of execution details for each retry attempt. Each entry in the array is an `ExecutionRecord` object that contains information about a single execution attempt, including whether it was successful or failed, the arguments used, the returned value or error, and the time taken.
-   `abort(reason?: unknown)`: A method to abort the retry process. You can provide an optional reason for the abortion, which will be passed to the rejection handler of the promise.

### NthChanceOptions

The `NthChanceOptions` interface allows you to configure the retry behavior. The delay between retries is calculated using an exponential backoff strategy with optional randomness. Here are the available options:

-   `totalTimeout` (optional): The total time (in milliseconds) allowed for all retries combined. Default is 30,000 (30 seconds).
-   `retries` (optional): The maximum number of retry attempts. Default is 2.
-   `delayMultiplier` (optional): The factor by which the delay time is increased by a factor of 2 between the end of a failed execution and the start of the next retry attempt.. Default is 1000 (1 second).
-   `maxDelay` (optional): The maximum delay (in milliseconds) between retries. Default is 10,000 (10 seconds).
-   `maxDelayVariation` (optional): The maximum random variation (in milliseconds) added to the delay. Default is 0.
-   `signal` (optional): An `AbortSignal` to abort the retry process.

### Decider Function

A `Decider` function determines whether to retry the operation and how long to wait before retrying.

```typescript
const retryableFunctionWithDecider = nthchance(exampleFunction).with(async (fn) => {
    if (fn.executions.length < 3) {
        // If there is less than 3 execution attempts, always retry with 1 second delay
        return {
            retry: true,
            delay: 1000,
            args: ['newArg1', 456], // Retry with this new arguments
        };
    } else if (fn.executions[fn.executions.length - 1].error) {
        // If the last execution attempts threw an exception, stop retying
        return {
            retry: false,
            error: new Error('Error retrying'), // The error to be rejected
        };
    } else {
        // Stop retrying and return the value
        return {
            retry: false,
            returnedValue: 123, // THe value to be returned
        };
    }
});

try {
    const result = await retryableFunctionWithDecider();
    console.log('Function succeeded with result:', result);
} catch (error) {
    console.error('Function failed with error:', error);
}
```

### Aborting Retries

You can abort the retry process at any time by calling the `abort` method on the retryable function or by using an [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) if provided in the options or the `with` function.

### ExecutionRecord

The `ExecutionRecord` type represents the outcome of an execution attempt. It can be either a `SuccesfulExecution` or a `FailedExecution`. Here are the details of each type and their properties:

#### Common properties

-   `startTime` (bigint): The high-resolution start time of the execution in nanoseconds.
-   `finishTime` (bigint): The high-resolution finish time of the execution in nanoseconds.
-   `decision` (optional): The decision made by the `Decider` regarding the retry attempt. It can be of type `DeciderOutcome`.
-   `aborted` (optional): A boolean indicating whether the execution was aborted.
-   `abortReason` (optional): The reason for abortion, if any.

#### SuccesfulExecution

The `SuccesfulExecution` interface represents a successful execution attempt:

-   `returnedValue`: The value returned by the function upon successful execution.

#### FailedExecution

The `FailedExecution` interfacerepresents a failed execution attempt:

-   `error` (unknown): The error encountered during the execution.

### DeciderOutcome

The `DeciderOutcome` type represents the possible outcomes of a decision made by the `Decider`. It can be one of the following:

-   `TryAgainDecision`: Indicates that the function should be retried.
-   `StopDecision`: Indicates that the function should not be retried and an error should be returned.
-   `ReturnDecision`: Indicates that the function should not be retried and a value should be returned.

#### TryAgainDecision

The `TryAgainDecision` interface represents a decision to retry the function:

-   `retry` (true): A boolean indicating that the function should be retried.
-   `delay` (optional): The delay (in milliseconds) before the next retry attempt.
-   `args` (optional): The arguments to be passed to the next retry attempt.

#### StopDecision

The `StopDecision` interface represents a decision to stop retrying the function:

-   `retry` (false): A boolean indicating that the function should not be retried.
-   `error` (unknown): The error to be returned to the caller in a rejected promise.

#### ReturnDecision

The `ReturnDecision` interface represents a decision to return a value successfully:

-   `retry` (false): A boolean indicating that the function should not be retried.
-   `returnedValue`: The value to be returned to the caller in a resolved promise.
