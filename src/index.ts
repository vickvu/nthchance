import {
    NthChance,
    type NthChanceOptions,
    type MainFunction,
    type NthChanceFunction,
    type BaseExcutionRecord,
    type FailedExecution,
    type SuccesfulExecution,
    type ExecutionRecord,
    type Decider,
    type TryAgainDecision,
    type StopDecision,
    type ReturnDecision,
    type DeciderOutcome,
} from '@SRC/nthchance';

export default function nthchance<TArgs extends readonly unknown[] = unknown[], TRetVal = unknown>(fn: MainFunction<TArgs, TRetVal>) {
    return new NthChance(fn);
}

export {
    NthChance,
    type NthChanceOptions,
    type MainFunction,
    type NthChanceFunction,
    type BaseExcutionRecord,
    type FailedExecution,
    type SuccesfulExecution,
    type ExecutionRecord,
    type Decider,
    type TryAgainDecision,
    type StopDecision,
    type ReturnDecision,
    type DeciderOutcome,
};
