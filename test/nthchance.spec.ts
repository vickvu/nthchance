import sinon from 'sinon';

import { NthChance, type DeciderOutcome, type Decider, type TryAgainDecision, type StopDecision } from '@SRC/nthchance';
import { assert } from 'chai';

const NANO_SECOND = 1000000n;

describe('NthChance', function () {
    let mainFunction: sinon.SinonStub<[string, number], object>;
    let decider: sinon.SinonStub<Parameters<Decider<[string, number], object>>, ReturnType<Decider<[string, number], object>>>;
    const arg1 = 'arg1';
    const arg2 = 123;
    const arg3 = 'arg3';
    const arg4 = 456;
    const val1 = { name: 'First' };
    const val2 = { name: 'Second' };
    const finalVal = { name: 'Final' };
    const err1 = new Error('Error1');
    const err2 = new Error('Error2');
    const err3 = new Error('Error3');
    const err4 = new Error('Error4');
    const err5 = new Error('Error5');
    const finalErr = new Error('Final');
    let clock: sinon.SinonFakeTimers;

    beforeEach(function () {
        clock = sinon.useFakeTimers();
        mainFunction = sinon.stub();
        mainFunction.onFirstCall().callsFake(function () {
            clock.tick(10);
            // Return without promise
            return val1;
        });
        mainFunction.onSecondCall().callsFake(function () {
            clock.tick(20);
            // Return a promise
            return Promise.resolve(val2);
        });
        mainFunction.onThirdCall().callsFake(function () {
            clock.tick(30);
            // Throw an error
            throw err1;
        });
        mainFunction.onCall(3).callsFake(function () {
            clock.tick(40);
            // Reject a promise
            return Promise.reject(err2);
        });
        decider = sinon.stub();
        decider.onFirstCall().returns({
            retry: true,
            args: [arg3, arg4],
        });
        decider.onSecondCall().resolves({
            retry: true,
            delay: 100,
        });
        decider.onThirdCall().returns({
            retry: true,
            delay: 1,
        });
    });

    afterEach(function () {
        clock.restore();
    });

    describe('retry options', function () {
        beforeEach(function () {
            mainFunction = sinon.stub();
            mainFunction.onFirstCall().callsFake(function () {
                clock.tick(10);
                // Throw an error
                throw err1;
            });
            mainFunction.onSecondCall().callsFake(function () {
                clock.tick(20);
                // Reject a promise
                return Promise.reject(err2);
            });
            mainFunction.onThirdCall().callsFake(function () {
                clock.tick(30);
                // Throw an error
                throw err3;
            });
            mainFunction.onCall(3).callsFake(function () {
                clock.tick(40);
                // Reject a promise
                return Promise.reject(err4);
            });
            mainFunction.onCall(4).callsFake(function () {
                clock.tick(50);
                // Throw an error
                throw err5;
            });
            mainFunction.onCall(5).callsFake(function () {
                clock.tick(30);
                return finalVal;
            });
        });

        it('should retry until successful', async function () {
            const retry = new NthChance(mainFunction).with({
                retries: 10,
                maxDelay: 850,
                delayMultiplier: 200,
                totalTimeout: 3000,
                maxDelayVariation: 10,
            });
            const resultPromise = retry(arg1, arg2);
            // Activate all timers and promise callbacks
            await clock.runAllAsync();
            (await resultPromise).should.equal(finalVal);
            sinon.assert.alwaysCalledWithExactly(mainFunction, arg1, arg2);
            sinon.assert.callCount(mainFunction, 6);
            retry.executions.should.have.lengthOf(6);
            retry.executions[0].should.deep.include({
                args: [arg1, arg2],
                error: err1,
                startTime: 0n,
                finishTime: 10n * NANO_SECOND,
            });
            const decision0: TryAgainDecision<[string, number]> = <TryAgainDecision<[string, number]>>retry.executions[0].decision;
            assert.exists(decision0);
            decision0.should.have.property('retry', true);
            assert.exists(decision0.delay);
            decision0.delay.should.be.within(200, 210);
            retry.executions[1].should.deep.include({
                args: [arg1, arg2],
                error: err2,
                startTime: (10n + BigInt(decision0.delay)) * NANO_SECOND,
                finishTime: (30n + BigInt(decision0.delay)) * NANO_SECOND,
            });
            const decision1: TryAgainDecision<[string, number]> = <TryAgainDecision<[string, number]>>retry.executions[1].decision;
            assert.exists(decision1);
            decision1.should.have.property('retry', true);
            assert.exists(decision1.delay);
            decision1.delay.should.be.within(400, 410);
            retry.executions[2].should.deep.include({
                args: [arg1, arg2],
                error: err3,
                startTime: (30n + BigInt(decision0.delay + decision1.delay)) * NANO_SECOND,
                finishTime: (60n + BigInt(decision0.delay + decision1.delay)) * NANO_SECOND,
            });
            const decision2: TryAgainDecision<[string, number]> = <TryAgainDecision<[string, number]>>retry.executions[2].decision;
            assert.exists(decision2);
            decision2.should.have.property('retry', true);
            assert.exists(decision2.delay);
            decision2.delay.should.be.within(800, 810);
            retry.executions[3].should.deep.include({
                args: [arg1, arg2],
                error: err4,
                startTime: (60n + BigInt(decision0.delay + decision1.delay + decision2.delay)) * NANO_SECOND,
                finishTime: (100n + BigInt(decision0.delay + decision1.delay + decision2.delay)) * NANO_SECOND,
            });
            const decision3: TryAgainDecision<[string, number]> = <TryAgainDecision<[string, number]>>retry.executions[3].decision;
            assert.exists(decision3);
            decision3.should.have.property('retry', true);
            assert.exists(decision3.delay);
            decision3.delay.should.equal(850);
            retry.executions[4].should.deep.include({
                args: [arg1, arg2],
                error: err5,
                startTime: (100n + BigInt(decision0.delay + decision1.delay + decision2.delay + decision3.delay)) * NANO_SECOND,
                finishTime: (150n + BigInt(decision0.delay + decision1.delay + decision2.delay + decision3.delay)) * NANO_SECOND,
            });
            const decision4: TryAgainDecision<[string, number]> = <TryAgainDecision<[string, number]>>retry.executions[4].decision;
            assert.exists(decision4);
            decision4.should.have.property('retry', true);
            assert.exists(decision4.delay);
            decision4.delay.should.equal(850);
            retry.executions[5].should.deep.include({
                args: [arg1, arg2],
                returnedValue: finalVal,
                startTime: (150n + BigInt(decision0.delay + decision1.delay + decision2.delay + decision3.delay + decision4.delay)) * NANO_SECOND,
                finishTime: (180n + BigInt(decision0.delay + decision1.delay + decision2.delay + decision3.delay + decision4.delay)) * NANO_SECOND,
            });
            const decision5: StopDecision = <StopDecision>retry.executions[5].decision;
            assert.exists(decision5);
            decision5.should.have.property('retry', false);
        });

        it('should retry until maximum retries count', async function () {
            const retry = new NthChance(mainFunction).with({
                retries: 3,
                maxDelay: 850,
                delayMultiplier: 200,
                totalTimeout: 3000,
                maxDelayVariation: 10,
            });
            const resultPromise = retry(arg1, arg2);
            // Activate all timers and promise callbacks
            await clock.runAllAsync();
            await resultPromise.should.be.rejectedWith(err4);
            sinon.assert.alwaysCalledWithExactly(mainFunction, arg1, arg2);
            sinon.assert.callCount(mainFunction, 4);
            retry.executions.should.have.lengthOf(4);
            retry.executions[0].should.deep.include({
                args: [arg1, arg2],
                error: err1,
                startTime: 0n,
                finishTime: 10n * NANO_SECOND,
            });
            const decision0: TryAgainDecision<[string, number]> = <TryAgainDecision<[string, number]>>retry.executions[0].decision;
            assert.exists(decision0);
            decision0.should.have.property('retry', true);
            assert.exists(decision0.delay);
            decision0.delay.should.be.within(200, 210);
            retry.executions[1].should.deep.include({
                args: [arg1, arg2],
                error: err2,
                startTime: (10n + BigInt(decision0.delay)) * NANO_SECOND,
                finishTime: (30n + BigInt(decision0.delay)) * NANO_SECOND,
            });
            const decision1: TryAgainDecision<[string, number]> = <TryAgainDecision<[string, number]>>retry.executions[1].decision;
            assert.exists(decision1);
            decision1.should.have.property('retry', true);
            assert.exists(decision1.delay);
            decision1.delay.should.be.within(400, 410);
            retry.executions[2].should.deep.include({
                args: [arg1, arg2],
                error: err3,
                startTime: (30n + BigInt(decision0.delay + decision1.delay)) * NANO_SECOND,
                finishTime: (60n + BigInt(decision0.delay + decision1.delay)) * NANO_SECOND,
            });
            const decision2: TryAgainDecision<[string, number]> = <TryAgainDecision<[string, number]>>retry.executions[2].decision;
            assert.exists(decision2);
            decision2.should.have.property('retry', true);
            assert.exists(decision2.delay);
            decision2.delay.should.be.within(800, 810);
            retry.executions[3].should.deep.include({
                args: [arg1, arg2],
                error: err4,
                startTime: (60n + BigInt(decision0.delay + decision1.delay + decision2.delay)) * NANO_SECOND,
                finishTime: (100n + BigInt(decision0.delay + decision1.delay + decision2.delay)) * NANO_SECOND,
            });
            const decision3: TryAgainDecision<[string, number]> = <TryAgainDecision<[string, number]>>retry.executions[3].decision;
            assert.exists(decision3);
            decision3.should.have.property('retry', false);
            assert.notExists(decision3.delay);
            decision3.should.have.property('error', err4);
        });
    });

    describe('decider', function () {
        it('should retry until decider says we should return', async function () {
            decider.onCall(3).resolves({
                retry: false,
                returnedValue: finalVal,
            });
            const retry = new NthChance(mainFunction).with(decider);
            const resultPromise = retry(arg1, arg2);
            sinon.assert.calledOnceWithExactly(mainFunction, arg1, arg2);
            sinon.assert.calledOnceWithExactly(decider, retry);
            retry.executions.should.deep.equal([
                {
                    args: [arg1, arg2],
                    returnedValue: val1,
                    startTime: 0n,
                    finishTime: 10n * NANO_SECOND,
                    decision: {
                        retry: true,
                        args: [arg3, arg4],
                    },
                },
            ]);
            // Activate the next run (schedule by setTimeout(0))
            clock.next();
            // Activate all the promise callback but stop at the setTimeout(100)
            await clock.tickAsync(1);
            sinon.assert.calledTwice(mainFunction);
            sinon.assert.calledWithExactly(mainFunction.secondCall, arg3, arg4);
            sinon.assert.calledTwice(decider);
            sinon.assert.calledWithExactly(decider.secondCall, retry);
            retry.executions.should.deep.equal([
                {
                    args: [arg1, arg2],
                    returnedValue: val1,
                    startTime: 0n,
                    finishTime: 10n * NANO_SECOND,
                    decision: {
                        retry: true,
                        args: [arg3, arg4],
                    },
                },
                {
                    args: [arg3, arg4],
                    returnedValue: val2,
                    startTime: 10n * NANO_SECOND,
                    finishTime: 30n * NANO_SECOND,
                    decision: {
                        retry: true,
                        delay: 100,
                    },
                },
            ]);
            // Just move the clock by 1 milisecond and check that the mainFunction
            // still has not called the third time, since we should have setTimeout(100)
            clock.tick(1);
            sinon.assert.calledTwice(mainFunction);
            sinon.assert.calledTwice(decider);
            // Now move the clock by 98 milliseconds to make the time as 100
            // The mainFunction should be called for the third time
            clock.tick(98);
            sinon.assert.calledThrice(mainFunction);
            sinon.assert.calledWithExactly(mainFunction.thirdCall, arg1, arg2);
            sinon.assert.calledThrice(decider);
            sinon.assert.calledWithExactly(decider.thirdCall, retry);
            retry.executions.should.deep.equal([
                {
                    args: [arg1, arg2],
                    returnedValue: val1,
                    startTime: 0n,
                    finishTime: 10n * NANO_SECOND,
                    decision: {
                        retry: true,
                        args: [arg3, arg4],
                    },
                },
                {
                    args: [arg3, arg4],
                    returnedValue: val2,
                    startTime: 10n * NANO_SECOND,
                    finishTime: 30n * NANO_SECOND,
                    decision: {
                        retry: true,
                        delay: 100,
                    },
                },
                {
                    args: [arg1, arg2],
                    error: err1,
                    startTime: 130n * NANO_SECOND,
                    finishTime: 160n * NANO_SECOND,
                    decision: {
                        retry: true,
                        delay: 1,
                    },
                },
            ]);
            // Activate the next run and all the promise callbacks
            await clock.nextAsync();
            sinon.assert.callCount(mainFunction, 4);
            sinon.assert.calledWithExactly(mainFunction.getCall(3), arg1, arg2);
            sinon.assert.callCount(decider, 4);
            sinon.assert.calledWithExactly(decider.getCall(3), retry);
            const result = await resultPromise;
            result.should.equal(finalVal);
            retry.executions.should.deep.equal([
                {
                    args: [arg1, arg2],
                    returnedValue: val1,
                    startTime: 0n,
                    finishTime: 10n * NANO_SECOND,
                    decision: {
                        retry: true,
                        args: [arg3, arg4],
                    },
                },
                {
                    args: [arg3, arg4],
                    returnedValue: val2,
                    startTime: 10n * NANO_SECOND,
                    finishTime: 30n * NANO_SECOND,
                    decision: {
                        retry: true,
                        delay: 100,
                    },
                },
                {
                    args: [arg1, arg2],
                    error: err1,
                    startTime: 130n * NANO_SECOND,
                    finishTime: 160n * NANO_SECOND,
                    decision: {
                        retry: true,
                        delay: 1,
                    },
                },
                {
                    args: [arg1, arg2],
                    error: err2,
                    startTime: 161n * NANO_SECOND,
                    finishTime: 201n * NANO_SECOND,
                    decision: {
                        retry: false,
                        returnedValue: finalVal,
                    },
                },
            ]);
        });

        it('should retry until decider says we should throw error', async function () {
            decider.onCall(3).resolves({
                retry: false,
                error: finalErr,
            });
            const retry = new NthChance(mainFunction).with(decider);
            const resultPromise = retry(arg1, arg2);
            // Activate all timers and promise callbacks
            await clock.runAllAsync();
            await resultPromise.should.be.rejectedWith(finalErr);
            retry.executions.should.deep.equal([
                {
                    args: [arg1, arg2],
                    returnedValue: val1,
                    startTime: 0n,
                    finishTime: 10n * NANO_SECOND,
                    decision: {
                        retry: true,
                        args: [arg3, arg4],
                    },
                },
                {
                    args: [arg3, arg4],
                    returnedValue: val2,
                    startTime: 10n * NANO_SECOND,
                    finishTime: 30n * NANO_SECOND,
                    decision: {
                        retry: true,
                        delay: 100,
                    },
                },
                {
                    args: [arg1, arg2],
                    error: err1,
                    startTime: 130n * NANO_SECOND,
                    finishTime: 160n * NANO_SECOND,
                    decision: {
                        retry: true,
                        delay: 1,
                    },
                },
                {
                    args: [arg1, arg2],
                    error: err2,
                    startTime: 161n * NANO_SECOND,
                    finishTime: 201n * NANO_SECOND,
                    decision: {
                        retry: false,
                        error: finalErr,
                    },
                },
            ]);
        });
    });

    describe('Without abort signal', function () {
        it('should be able to be cancelled between retry', async function () {
            const retry = new NthChance(mainFunction).with(decider);
            const resultPromise = retry(arg1, arg2);
            sinon.assert.calledOnce(mainFunction);
            sinon.assert.calledOnce(decider);
            retry.abort('User cancelled');
            // Activate all timers and promise callbacks
            await clock.runAllAsync();
            sinon.assert.calledOnce(mainFunction);
            sinon.assert.calledOnce(decider);
            await resultPromise.should.be.rejectedWith('Aborted: User cancelled');
            retry.executions.should.deep.equal([
                {
                    args: [arg1, arg2],
                    returnedValue: val1,
                    startTime: 0n,
                    finishTime: 10n * NANO_SECOND,
                    decision: {
                        retry: true,
                        args: [arg3, arg4],
                    },
                    aborted: true,
                    abortReason: 'User cancelled',
                },
            ]);
        });

        it('should be able to be cancelled inside the decider', async function () {
            const retry = new NthChance(mainFunction).with(decider);
            const abortErr = new Error('User cancelled');
            const neverErr = new Error('Never happened');
            decider.onSecondCall().callsFake(function () {
                retry.abort(abortErr);
                return {
                    retry: false,
                    error: neverErr,
                };
            });
            const resultPromise = retry(arg1, arg2);
            sinon.assert.calledOnce(mainFunction);
            sinon.assert.calledOnce(decider);
            // Activate all timers and promise callbacks
            await clock.runAllAsync();
            sinon.assert.calledTwice(mainFunction);
            sinon.assert.calledTwice(decider);
            await resultPromise.should.be.rejectedWith(abortErr);
            retry.executions.should.deep.equal([
                {
                    args: [arg1, arg2],
                    returnedValue: val1,
                    startTime: 0n,
                    finishTime: 10n * NANO_SECOND,
                    decision: {
                        retry: true,
                        args: [arg3, arg4],
                    },
                },
                {
                    args: [arg3, arg4],
                    returnedValue: val2,
                    startTime: 10n * NANO_SECOND,
                    finishTime: 30n * NANO_SECOND,
                    decision: {
                        retry: false,
                        error: neverErr,
                    },
                    aborted: true,
                    abortReason: abortErr,
                },
            ]);
        });

        it('should be able to be cancelled inside the main function', async function () {
            const retry = new NthChance(mainFunction).with(decider);
            const neverErr = new Error('Never happened');
            mainFunction.onSecondCall().callsFake(function () {
                retry.abort();
                throw neverErr;
            });
            const resultPromise = retry(arg1, arg2);
            sinon.assert.calledOnce(mainFunction);
            sinon.assert.calledOnce(decider);
            // Activate all timers and promise callbacks
            await clock.runAllAsync();
            sinon.assert.calledTwice(mainFunction);
            sinon.assert.calledOnce(decider);
            await resultPromise.should.be.rejectedWith(/Aborted/);
            retry.executions[0].should.deep.equal({
                args: [arg1, arg2],
                returnedValue: val1,
                startTime: 0n,
                finishTime: 10n * NANO_SECOND,
                decision: {
                    retry: true,
                    args: [arg3, arg4],
                },
            });
            assert.notExists(retry.executions[1].abortReason);
        });
    });

    describe('With abort signal', function () {
        let ac: AbortController;

        beforeEach(function () {
            ac = new AbortController();
        });

        it('should be able to be cancelled between retry', async function () {
            const retry = new NthChance(mainFunction).with(decider, ac.signal);
            const resultPromise = retry(arg1, arg2);
            sinon.assert.calledOnce(mainFunction);
            sinon.assert.calledOnce(decider);
            ac.abort('User cancelled');
            // Activate all timers and promise callbacks
            await clock.runAllAsync();
            sinon.assert.calledOnce(mainFunction);
            sinon.assert.calledOnce(decider);
            await resultPromise.should.be.rejectedWith('Aborted: User cancelled');
            retry.executions.should.deep.equal([
                {
                    args: [arg1, arg2],
                    returnedValue: val1,
                    startTime: 0n,
                    finishTime: 10n * NANO_SECOND,
                    decision: {
                        retry: true,
                        args: [arg3, arg4],
                    },
                    aborted: true,
                    abortReason: 'User cancelled',
                },
            ]);
        });

        it('should be able to be cancelled inside the decider', async function () {
            const retry = new NthChance(mainFunction).with(decider, ac.signal);
            const abortErr = new Error('User cancelled');
            const neverErr = new Error('Never happened');
            decider.onSecondCall().callsFake(function () {
                ac.abort(abortErr);
                return {
                    retry: false,
                    error: neverErr,
                };
            });
            const resultPromise = retry(arg1, arg2);
            sinon.assert.calledOnce(mainFunction);
            sinon.assert.calledOnce(decider);
            // Activate all timers and promise callbacks
            await clock.runAllAsync();
            sinon.assert.calledTwice(mainFunction);
            sinon.assert.calledTwice(decider);
            await resultPromise.should.be.rejectedWith(abortErr);
            retry.executions.should.deep.equal([
                {
                    args: [arg1, arg2],
                    returnedValue: val1,
                    startTime: 0n,
                    finishTime: 10n * NANO_SECOND,
                    decision: {
                        retry: true,
                        args: [arg3, arg4],
                    },
                },
                {
                    args: [arg3, arg4],
                    returnedValue: val2,
                    startTime: 10n * NANO_SECOND,
                    finishTime: 30n * NANO_SECOND,
                    decision: {
                        retry: false,
                        error: neverErr,
                    },
                    aborted: true,
                    abortReason: abortErr,
                },
            ]);
        });

        it('should be able to be cancelled inside the main function', async function () {
            const retry = new NthChance(mainFunction).with(decider, ac.signal);
            const neverErr = new Error('Never happened');
            mainFunction.onSecondCall().callsFake(function () {
                ac.abort();
                throw neverErr;
            });
            const resultPromise = retry(arg1, arg2);
            sinon.assert.calledOnce(mainFunction);
            sinon.assert.calledOnce(decider);
            // Activate all timers and promise callbacks
            await clock.runAllAsync();
            sinon.assert.calledTwice(mainFunction);
            sinon.assert.calledOnce(decider);
            await resultPromise.should.be.rejectedWith(Error);
            retry.executions.should.have.length(2);
            retry.executions[0].should.deep.equal({
                args: [arg1, arg2],
                returnedValue: val1,
                startTime: 0n,
                finishTime: 10n * NANO_SECOND,
                decision: {
                    retry: true,
                    args: [arg3, arg4],
                },
            });
            retry.executions[1].should.have.property('abortReason');
        });
    });

    describe('Edge cases handling', function () {
        it('should handle error in the main function promise then function', async function () {
            const err = new Error('Error in then function');
            mainFunction.onSecondCall().callsFake(function () {
                return {
                    then: function () {
                        throw err;
                    },
                };
            });
            const retry = new NthChance(mainFunction).with(decider);
            const resultPromise = retry(arg1, arg2);
            // Activate all timers and promise callbacks
            await clock.runAllAsync();
            await resultPromise.should.be.rejectedWith(err);
        });

        it('should handle error in the decider', async function () {
            const err = new Error('Error in the decider');
            decider.onSecondCall().callsFake(function () {
                throw err;
            });
            const retry = new NthChance(mainFunction).with(decider);
            const resultPromise = retry(arg1, arg2);
            // Activate all timers and promise callbacks
            await clock.runAllAsync();
            await resultPromise.should.be.rejectedWith(err);
        });

        it('should handle promise rejection in the decider', async function () {
            const err = new Error('Error in the decider');
            decider.onSecondCall().callsFake(function () {
                return Promise.reject(err);
            });
            const retry = new NthChance(mainFunction).with(decider);
            const resultPromise = retry(arg1, arg2);
            // Activate all timers and promise callbacks
            await clock.runAllAsync();
            await resultPromise.should.be.rejectedWith(err);
        });

        it('should handle error in the decider promise then function', async function () {
            const err = new Error('Error in then function');
            decider.onSecondCall().callsFake(function () {
                return <DeciderOutcome<[string, number], object>>(<unknown>{
                    then: function () {
                        throw err;
                    },
                });
            });
            const retry = new NthChance(mainFunction).with(decider);
            const resultPromise = retry(arg1, arg2);
            // Activate all timers and promise callbacks
            await clock.runAllAsync();
            await resultPromise.should.be.rejectedWith(err);
        });
    });
});
