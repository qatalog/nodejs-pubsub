"use strict";
/*!
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const mocha_1 = require("mocha");
const events_1 = require("events");
const google_gax_1 = require("google-gax");
const sinon = require("sinon");
const uuid = require("uuid");
const defer = require("p-defer");
const messageTypes = require("../src/message-queues");
class FakeClient {
    async acknowledge(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    reqOpts, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    callOptions) { }
    async modifyAckDeadline(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    reqOpts, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    callOptions) { }
}
class FakeSubscriber extends events_1.EventEmitter {
    constructor() {
        super();
        this.name = uuid.v4();
        this.client = new FakeClient();
        this.iEOS = false;
    }
    async getClient() {
        return this.client;
    }
    get isExactlyOnceDelivery() {
        return this.iEOS;
    }
}
class FakeMessage {
    constructor() {
        this.ackId = uuid.v4();
    }
}
function fakeMessage() {
    return new FakeMessage();
}
class MessageQueue extends messageTypes.MessageQueue {
    constructor() {
        super(...arguments);
        this.batches = [];
    }
    async _sendBatch(batch) {
        this.batches.push(batch);
        return [];
    }
}
class AckQueue extends messageTypes.AckQueue {
    get requests() {
        return this._requests;
    }
}
class ModAckQueue extends messageTypes.ModAckQueue {
    get requests() {
        return this._requests;
    }
}
function allSettled(proms) {
    const checkedProms = proms.map((r) => r
        .then((value) => ({
        status: 'fulfilled',
        value,
    }))
        .catch((error) => ({
        status: 'rejected',
        reason: error,
    })));
    return Promise.all(checkedProms);
}
(0, mocha_1.describe)('MessageQueues', () => {
    const sandbox = sinon.createSandbox();
    let fakeSubscriber;
    let subscriber;
    (0, mocha_1.before)(() => { });
    (0, mocha_1.beforeEach)(() => {
        fakeSubscriber = new FakeSubscriber();
        subscriber = fakeSubscriber;
    });
    (0, mocha_1.afterEach)(() => sandbox.restore());
    (0, mocha_1.describe)('MessageQueue', () => {
        let messageQueue;
        (0, mocha_1.beforeEach)(() => {
            messageQueue = new MessageQueue(subscriber);
        });
        (0, mocha_1.describe)('initialization', () => {
            (0, mocha_1.it)('should default numPendingRequests', () => {
                assert.strictEqual(messageQueue.numPendingRequests, 0);
            });
            (0, mocha_1.it)('should set any provided options', () => {
                const fakeOptions = {};
                const stub = sandbox.stub(MessageQueue.prototype, 'setOptions');
                new MessageQueue(subscriber, fakeOptions);
                const [options] = stub.lastCall.args;
                assert.strictEqual(options, fakeOptions);
            });
        });
        (0, mocha_1.describe)('maxMilliseconds', () => {
            (0, mocha_1.it)('should return the maxMilliseconds option', () => {
                const maxMilliseconds = 101;
                messageQueue.setOptions({ maxMilliseconds });
                assert.strictEqual(messageQueue.maxMilliseconds, maxMilliseconds);
            });
        });
        (0, mocha_1.describe)('add', () => {
            (0, mocha_1.it)('should increase the number of pending requests', () => {
                messageQueue.add(new FakeMessage());
                assert.strictEqual(messageQueue.numPendingRequests, 1);
            });
            (0, mocha_1.it)('should flush the queue if at capacity', () => {
                const stub = sandbox.stub(messageQueue, 'flush');
                messageQueue.setOptions({ maxMessages: 1 });
                messageQueue.add(new FakeMessage());
                assert.strictEqual(stub.callCount, 1);
            });
            (0, mocha_1.it)('should schedule a flush if needed', () => {
                const clock = sandbox.useFakeTimers();
                const stub = sandbox.stub(messageQueue, 'flush');
                const delay = 1000;
                messageQueue.setOptions({ maxMilliseconds: delay });
                messageQueue.add(new FakeMessage());
                assert.strictEqual(stub.callCount, 0);
                clock.tick(delay);
                assert.strictEqual(stub.callCount, 1);
            });
            (0, mocha_1.it)('should return a Promise that resolves when the ack is sent', async () => {
                const clock = sandbox.useFakeTimers();
                const delay = 1000;
                messageQueue.setOptions({ maxMilliseconds: delay });
                sandbox
                    .stub(messageQueue, '_sendBatch')
                    .callsFake((batch) => {
                    batch.forEach(m => {
                        var _a;
                        (_a = m.responsePromise) === null || _a === void 0 ? void 0 : _a.resolve();
                    });
                    return Promise.resolve([]);
                });
                const completion = messageQueue.add(new FakeMessage());
                clock.tick(delay);
                await completion;
            });
        });
        (0, mocha_1.describe)('flush', () => {
            (0, mocha_1.it)('should cancel scheduled flushes', () => {
                const clock = sandbox.useFakeTimers();
                const spy = sandbox.spy(messageQueue, 'flush');
                const delay = 1000;
                messageQueue.setOptions({ maxMilliseconds: delay });
                messageQueue.add(new FakeMessage());
                messageQueue.flush();
                clock.tick(delay);
                assert.strictEqual(spy.callCount, 1);
            });
            (0, mocha_1.it)('should remove the messages from the queue', () => {
                messageQueue.add(new FakeMessage());
                messageQueue.flush();
                assert.strictEqual(messageQueue.numPendingRequests, 0);
            });
            (0, mocha_1.it)('should send the batch', () => {
                var _a;
                const message = new FakeMessage();
                const deadline = 10;
                messageQueue.add(message, deadline);
                messageQueue.flush();
                const [batch] = messageQueue.batches;
                assert.strictEqual(batch[0].ackId, message.ackId);
                assert.strictEqual(batch[0].deadline, deadline);
                assert.ok((_a = batch[0].responsePromise) === null || _a === void 0 ? void 0 : _a.resolve);
            });
            (0, mocha_1.it)('should emit any errors as debug events', done => {
                const fakeError = new Error('err');
                sandbox.stub(messageQueue.batches, 'push').throws(fakeError);
                subscriber.on('debug', err => {
                    assert.strictEqual(err, fakeError);
                    done();
                });
                messageQueue.flush();
            });
            (0, mocha_1.it)('should resolve any pending promises', () => {
                const promise = messageQueue.onFlush();
                setImmediate(() => messageQueue.flush());
                return promise;
            });
            (0, mocha_1.it)('should resolve onDrain only after all in-flight messages have been flushed', async () => {
                const log = [];
                const sendDone = defer();
                sandbox.stub(messageQueue, '_sendBatch').callsFake(async () => {
                    log.push('send:start');
                    await sendDone.promise;
                    log.push('send:end');
                    return [];
                });
                const message = new FakeMessage();
                const deadline = 10;
                const onDrainBeforeFlush = messageQueue
                    .onDrain()
                    .then(() => log.push('drain1'));
                messageQueue.add(message, deadline);
                messageQueue.flush();
                assert.deepStrictEqual(log, ['send:start']);
                sendDone.resolve();
                await messageQueue.onDrain().then(() => log.push('drain2'));
                await onDrainBeforeFlush;
                assert.deepStrictEqual(log, [
                    'send:start',
                    'send:end',
                    'drain1',
                    'drain2',
                ]);
            });
        });
        (0, mocha_1.describe)('onFlush', () => {
            (0, mocha_1.it)('should create a promise', () => {
                const promise = messageQueue.onFlush();
                assert(promise instanceof Promise);
            });
            (0, mocha_1.it)('should re-use existing promises', () => {
                const promise1 = messageQueue.onFlush();
                const promise2 = messageQueue.onFlush();
                assert.strictEqual(promise1, promise2);
            });
        });
        (0, mocha_1.describe)('onDrain', () => {
            (0, mocha_1.it)('should create a promise', () => {
                const promise = messageQueue.onDrain();
                assert(promise instanceof Promise);
            });
            (0, mocha_1.it)('should re-use existing promises', () => {
                const promise1 = messageQueue.onDrain();
                const promise2 = messageQueue.onDrain();
                assert.strictEqual(promise1, promise2);
            });
        });
        (0, mocha_1.describe)('setOptions', () => {
            (0, mocha_1.it)('should default maxMessages to 3000', () => {
                const stub = sandbox.stub(messageQueue, 'flush');
                for (let i = 0; i < 3000; i++) {
                    assert.strictEqual(stub.callCount, 0);
                    messageQueue.add(fakeMessage());
                }
                assert.strictEqual(stub.callCount, 1);
            });
            (0, mocha_1.it)('should respect user supplied maxMessages', () => {
                const stub = sandbox.stub(messageQueue, 'flush');
                const maxMessages = 100;
                messageQueue.setOptions({ maxMessages });
                for (let i = 0; i < maxMessages; i++) {
                    assert.strictEqual(stub.callCount, 0);
                    messageQueue.add(fakeMessage());
                }
                assert.strictEqual(stub.callCount, 1);
            });
            (0, mocha_1.it)('should default maxMilliseconds to 100', () => {
                const clock = sandbox.useFakeTimers();
                const stub = sandbox.stub(messageQueue, 'flush');
                messageQueue.add(fakeMessage());
                clock.tick(100);
                assert.strictEqual(stub.callCount, 1);
            });
            (0, mocha_1.it)('should respect user supplied maxMilliseconds', () => {
                const clock = sandbox.useFakeTimers();
                const stub = sandbox.stub(messageQueue, 'flush');
                const maxMilliseconds = 10000;
                messageQueue.setOptions({ maxMilliseconds });
                messageQueue.add(fakeMessage());
                clock.tick(maxMilliseconds);
                assert.strictEqual(stub.callCount, 1);
            });
        });
    });
    (0, mocha_1.describe)('AckQueue', () => {
        let ackQueue;
        (0, mocha_1.beforeEach)(() => {
            ackQueue = new AckQueue(subscriber);
        });
        (0, mocha_1.it)('should send batches via Client#acknowledge', async () => {
            const messages = [
                new FakeMessage(),
                new FakeMessage(),
                new FakeMessage(),
            ];
            const stub = sandbox
                .stub(fakeSubscriber.client, 'acknowledge')
                .resolves();
            const expectedReqOpts = {
                subscription: subscriber.name,
                ackIds: messages.map(({ ackId }) => ackId),
            };
            messages.forEach(message => ackQueue.add(message));
            await ackQueue.flush();
            const [reqOpts] = stub.lastCall.args;
            assert.deepStrictEqual(reqOpts, expectedReqOpts);
        });
        (0, mocha_1.it)('should send call options', async () => {
            const fakeCallOptions = { timeout: 10000 };
            const stub = sandbox
                .stub(fakeSubscriber.client, 'acknowledge')
                .resolves();
            ackQueue.setOptions({ callOptions: fakeCallOptions });
            await ackQueue.flush();
            const [, callOptions] = stub.lastCall.args;
            assert.strictEqual(callOptions, fakeCallOptions);
        });
        (0, mocha_1.it)('should throw a BatchError on "debug" if unable to ack due to grpc error', done => {
            const messages = [
                new FakeMessage(),
                new FakeMessage(),
                new FakeMessage(),
            ];
            const ackIds = messages.map(message => message.ackId);
            const fakeError = new Error('Err.');
            fakeError.code = google_gax_1.Status.DATA_LOSS;
            // Since this runs without EOS enabled, we should get the old error handling.
            const expectedMessage = 'Failed to "ack" for 3 message(s). Reason: Err.';
            sandbox.stub(fakeSubscriber.client, 'acknowledge').rejects(fakeError);
            subscriber.on('debug', (err) => {
                try {
                    assert.strictEqual(err.message, expectedMessage);
                    assert.deepStrictEqual(err.ackIds, ackIds);
                    assert.strictEqual(err.code, fakeError.code);
                    done();
                }
                catch (e) {
                    // I'm unsure why Mocha's regular handler doesn't work here,
                    // but manually throw the exception from asserts.
                    done(e);
                }
            });
            messages.forEach(message => ackQueue.add(message));
            ackQueue.flush();
        });
        // The analogous modAck version is very similar, so please sync changes.
        (0, mocha_1.describe)('handle ack responses when !isExactlyOnceDelivery', () => {
            (0, mocha_1.it)('should appropriately resolve result promises when !isExactlyOnceDelivery', async () => {
                const fakeError = new Error('Err.');
                fakeError.code = google_gax_1.Status.DATA_LOSS;
                const stub = sandbox
                    .stub(fakeSubscriber.client, 'acknowledge')
                    .rejects(fakeError);
                const message = new FakeMessage();
                const completion = ackQueue.add(message);
                await ackQueue.flush();
                assert.strictEqual(stub.callCount, 1);
                await assert.doesNotReject(completion);
            });
        });
        // The analogous modAck version is very similar, so please sync changes.
        (0, mocha_1.describe)('handle ack responses for exactly-once delivery', () => {
            (0, mocha_1.beforeEach)(() => {
                fakeSubscriber.iEOS = true;
            });
            (0, mocha_1.it)('should trigger Promise resolves on no errors', async () => {
                const messages = [fakeMessage(), fakeMessage(), fakeMessage()];
                messages.forEach(m => ackQueue.add(m));
                sandbox.stub(fakeSubscriber.client, 'acknowledge').resolves();
                const proms = ackQueue.requests.map((r) => r.responsePromise.promise);
                await ackQueue.flush();
                const results = await allSettled(proms);
                const oneSuccess = { status: 'fulfilled', value: undefined };
                assert.deepStrictEqual(results, [oneSuccess, oneSuccess, oneSuccess]);
            });
            (0, mocha_1.it)('should trigger Promise failures on grpc errors', async () => {
                var _a, _b;
                const messages = [fakeMessage(), fakeMessage(), fakeMessage()];
                const fakeError = new Error('Err.');
                fakeError.code = google_gax_1.Status.DATA_LOSS;
                fakeError.errorInfoMetadata = {
                    // These should be routed by the errorInfo resolver.
                    [messages[0].ackId]: 'TRANSIENT_CAT_ATE_HOMEWORK',
                };
                messages.forEach(m => ackQueue.add(m));
                sandbox.stub(fakeSubscriber.client, 'acknowledge').rejects(fakeError);
                const proms = ackQueue.requests.map((r) => r.responsePromise.promise);
                proms.shift();
                await ackQueue.flush();
                const results = await allSettled(proms);
                assert.strictEqual(results[0].status, 'rejected');
                assert.strictEqual((_a = results[0].reason) === null || _a === void 0 ? void 0 : _a.errorCode, 'OTHER');
                assert.strictEqual(results[1].status, 'rejected');
                assert.strictEqual((_b = results[1].reason) === null || _b === void 0 ? void 0 : _b.errorCode, 'OTHER');
                // Make sure the one handled by errorInfo was retried.
                assert.strictEqual(ackQueue.numInRetryRequests, 1);
            });
            (0, mocha_1.it)('should correctly handle a mix of errors and successes', async () => {
                var _a;
                const messages = [fakeMessage(), fakeMessage(), fakeMessage()];
                const fakeError = new Error('Err.');
                delete fakeError.code;
                fakeError.errorInfoMetadata = {
                    [messages[0].ackId]: 'PERMANENT_FAILURE_INVALID_ACK_ID',
                    [messages[1].ackId]: 'TRANSIENT_CAT_ATE_HOMEWORK',
                };
                messages.forEach(m => ackQueue.add(m));
                sandbox.stub(fakeSubscriber.client, 'acknowledge').rejects(fakeError);
                const proms = [
                    ackQueue.requests[0].responsePromise.promise,
                    ackQueue.requests[2].responsePromise.promise,
                ];
                await ackQueue.flush();
                const results = await allSettled(proms);
                assert.strictEqual(results[0].status, 'rejected');
                assert.strictEqual((_a = results[0].reason) === null || _a === void 0 ? void 0 : _a.errorCode, 'INVALID');
                // Since there's no RPC error, the last one should've succeeded.
                const oneSuccess = { status: 'fulfilled', value: undefined };
                assert.deepStrictEqual(results[1], oneSuccess);
                // Make sure the transient one was retried.
                assert.strictEqual(ackQueue.numInRetryRequests, 1);
            });
            // This is separate because the retry mechanism itself could fail, and
            // we want to make sure that transients actually make it back into the
            // queue for retry.
            //
            // This doesn't need to be duplicated down to modAck because it's just
            // testing common code.
            (0, mocha_1.it)('should retry transient failures', async () => {
                const clock = sandbox.useFakeTimers();
                sandbox.stub(global.Math, 'random').returns(0.5);
                const message = fakeMessage();
                const fakeError = new Error('Err.');
                fakeError.code = google_gax_1.Status.DATA_LOSS;
                fakeError.errorInfoMetadata = {
                    // These should be routed by the errorInfo resolver.
                    [message.ackId]: 'TRANSIENT_CAT_ATE_HOMEWORK',
                };
                sandbox.stub(fakeSubscriber.client, 'acknowledge').rejects(fakeError);
                ackQueue.add(message);
                await ackQueue.flush();
                // Make sure the one handled by errorInfo was retried.
                assert.strictEqual(ackQueue.numInRetryRequests, 1);
                // And wait for a second attempt.
                clock.tick(1000);
                assert.strictEqual(ackQueue.requests.length, 1);
                assert.strictEqual(ackQueue.requests[0].ackId, message.ackId);
                assert.strictEqual(ackQueue.numInRetryRequests, 0);
                assert.strictEqual(ackQueue.numPendingRequests, 1);
            });
        });
        (0, mocha_1.it)('should appropriately resolve result promises', async () => {
            const stub = sandbox
                .stub(fakeSubscriber.client, 'acknowledge')
                .resolves();
            const message = new FakeMessage();
            const completion = ackQueue.add(message);
            await ackQueue.flush();
            assert.strictEqual(stub.callCount, 1);
            await completion;
        });
        (0, mocha_1.it)('should appropriately reject result promises', async () => {
            const stub = sandbox
                .stub(fakeSubscriber.client, 'acknowledge')
                .resolves();
            const message = new FakeMessage();
            const completion = ackQueue.add(message);
            await ackQueue.flush();
            assert.strictEqual(stub.callCount, 1);
            await completion;
        });
    });
    (0, mocha_1.describe)('ModAckQueue', () => {
        let modAckQueue;
        (0, mocha_1.beforeEach)(() => {
            modAckQueue = new ModAckQueue(subscriber);
        });
        (0, mocha_1.it)('should send batches via Client#modifyAckDeadline', async () => {
            const deadline = 600;
            const messages = [
                new FakeMessage(),
                new FakeMessage(),
                new FakeMessage(),
            ];
            const stub = sandbox
                .stub(fakeSubscriber.client, 'modifyAckDeadline')
                .resolves();
            const expectedReqOpts = {
                subscription: subscriber.name,
                ackDeadlineSeconds: deadline,
                ackIds: messages.map(({ ackId }) => ackId),
            };
            messages.forEach(message => modAckQueue.add(message, deadline));
            await modAckQueue.flush();
            const [reqOpts] = stub.lastCall.args;
            assert.deepStrictEqual(reqOpts, expectedReqOpts);
        });
        (0, mocha_1.it)('should group ackIds by deadline', async () => {
            const deadline1 = 600;
            const deadline2 = 1000;
            const messages1 = [
                new FakeMessage(),
                new FakeMessage(),
                new FakeMessage(),
            ];
            const messages2 = [
                new FakeMessage(),
                new FakeMessage(),
                new FakeMessage(),
            ];
            const stub = sandbox
                .stub(fakeSubscriber.client, 'modifyAckDeadline')
                .resolves();
            const expectedReqOpts1 = {
                subscription: subscriber.name,
                ackDeadlineSeconds: deadline1,
                ackIds: messages1.map(({ ackId }) => ackId),
            };
            const expectedReqOpts2 = {
                subscription: subscriber.name,
                ackDeadlineSeconds: deadline2,
                ackIds: messages2.map(({ ackId }) => ackId),
            };
            messages1.forEach(message => modAckQueue.add(message, deadline1));
            messages2.forEach(message => modAckQueue.add(message, deadline2));
            await modAckQueue.flush();
            const [reqOpts1] = stub.getCall(0).args;
            assert.deepStrictEqual(reqOpts1, expectedReqOpts1);
            const [reqOpts2] = stub.getCall(1).args;
            assert.deepStrictEqual(reqOpts2, expectedReqOpts2);
        });
        (0, mocha_1.it)('should send call options', async () => {
            const fakeCallOptions = { timeout: 10000 };
            const stub = sandbox
                .stub(fakeSubscriber.client, 'modifyAckDeadline')
                .resolves();
            modAckQueue.setOptions({ callOptions: fakeCallOptions });
            modAckQueue.add(new FakeMessage(), 10);
            await modAckQueue.flush();
            const [, callOptions] = stub.lastCall.args;
            assert.strictEqual(callOptions, fakeCallOptions);
        });
        (0, mocha_1.it)('should throw a BatchError on "debug" if unable to modAck due to gRPC error', done => {
            const messages = [
                new FakeMessage(),
                new FakeMessage(),
                new FakeMessage(),
            ];
            const ackIds = messages.map(message => message.ackId);
            const fakeError = new Error('Err.');
            fakeError.code = google_gax_1.Status.DATA_LOSS;
            // Since this runs without EOS enabled, we should get the old error handling.
            const expectedMessage = 'Failed to "modAck" for 3 message(s). Reason: Err.';
            sandbox
                .stub(fakeSubscriber.client, 'modifyAckDeadline')
                .rejects(fakeError);
            subscriber.on('debug', (err) => {
                try {
                    assert.strictEqual(err.message, expectedMessage);
                    assert.deepStrictEqual(err.ackIds, ackIds);
                    assert.strictEqual(err.code, fakeError.code);
                    done();
                }
                catch (e) {
                    // I'm unsure why Mocha's regular handler doesn't work here,
                    // but manually throw the exception from asserts.
                    done(e);
                }
            });
            messages.forEach(message => modAckQueue.add(message));
            modAckQueue.flush();
        });
        (0, mocha_1.describe)('handle modAck responses when !isExactlyOnceDelivery', () => {
            (0, mocha_1.it)('should appropriately resolve result promises when !isExactlyOnceDelivery', async () => {
                const fakeError = new Error('Err.');
                fakeError.code = google_gax_1.Status.DATA_LOSS;
                const stub = sandbox
                    .stub(fakeSubscriber.client, 'modifyAckDeadline')
                    .rejects(fakeError);
                const message = new FakeMessage();
                const completion = modAckQueue.add(message);
                await modAckQueue.flush();
                assert.strictEqual(stub.callCount, 1);
                await assert.doesNotReject(completion);
            });
        });
        // The analogous ack version is very similar, so please sync changes.
        (0, mocha_1.describe)('handle modAck responses for exactly-once delivery', () => {
            (0, mocha_1.beforeEach)(() => {
                fakeSubscriber.iEOS = true;
            });
            (0, mocha_1.it)('should trigger Promise resolves on no errors', async () => {
                const messages = [fakeMessage(), fakeMessage(), fakeMessage()];
                messages.forEach(m => modAckQueue.add(m));
                sandbox.stub(fakeSubscriber.client, 'modifyAckDeadline').resolves();
                const proms = modAckQueue.requests.map((r) => r.responsePromise.promise);
                await modAckQueue.flush();
                const results = await allSettled(proms);
                const oneSuccess = { status: 'fulfilled', value: undefined };
                assert.deepStrictEqual(results, [oneSuccess, oneSuccess, oneSuccess]);
            });
            (0, mocha_1.it)('should trigger Promise failures on grpc errors', async () => {
                var _a, _b;
                const messages = [fakeMessage(), fakeMessage(), fakeMessage()];
                const fakeError = new Error('Err.');
                fakeError.code = google_gax_1.Status.DATA_LOSS;
                fakeError.errorInfoMetadata = {
                    // These should be routed by the errorInfo resolver.
                    [messages[0].ackId]: 'TRANSIENT_CAT_ATE_HOMEWORK',
                };
                messages.forEach(m => modAckQueue.add(m));
                sandbox
                    .stub(fakeSubscriber.client, 'modifyAckDeadline')
                    .rejects(fakeError);
                const proms = modAckQueue.requests.map((r) => r.responsePromise.promise);
                proms.shift();
                await modAckQueue.flush();
                const results = await allSettled(proms);
                assert.strictEqual(results[0].status, 'rejected');
                assert.strictEqual((_a = results[0].reason) === null || _a === void 0 ? void 0 : _a.errorCode, 'OTHER');
                assert.strictEqual(results[1].status, 'rejected');
                assert.strictEqual((_b = results[1].reason) === null || _b === void 0 ? void 0 : _b.errorCode, 'OTHER');
                // Make sure the one handled by errorInfo was retried.
                assert.strictEqual(modAckQueue.numInRetryRequests, 1);
            });
            (0, mocha_1.it)('should correctly handle a mix of errors and successes', async () => {
                var _a;
                const messages = [fakeMessage(), fakeMessage(), fakeMessage()];
                const fakeError = new Error('Err.');
                delete fakeError.code;
                fakeError.errorInfoMetadata = {
                    [messages[0].ackId]: 'PERMANENT_FAILURE_INVALID_ACK_ID',
                    [messages[1].ackId]: 'TRANSIENT_CAT_ATE_HOMEWORK',
                };
                messages.forEach(m => modAckQueue.add(m));
                sandbox
                    .stub(fakeSubscriber.client, 'modifyAckDeadline')
                    .rejects(fakeError);
                const proms = [
                    modAckQueue.requests[0].responsePromise.promise,
                    modAckQueue.requests[2].responsePromise.promise,
                ];
                await modAckQueue.flush();
                const results = await allSettled(proms);
                assert.strictEqual(results[0].status, 'rejected');
                assert.strictEqual((_a = results[0].reason) === null || _a === void 0 ? void 0 : _a.errorCode, 'INVALID');
                // Since there's no RPC error, the last one should've succeeded.
                const oneSuccess = { status: 'fulfilled', value: undefined };
                assert.deepStrictEqual(results[1], oneSuccess);
                // Make sure the transient one was retried.
                assert.strictEqual(modAckQueue.numInRetryRequests, 1);
            });
        });
        (0, mocha_1.it)('should appropriately resolve result promises', async () => {
            const stub = sandbox
                .stub(fakeSubscriber.client, 'modifyAckDeadline')
                .resolves();
            const message = new FakeMessage();
            const completion = modAckQueue.add(message);
            await modAckQueue.flush();
            assert.strictEqual(stub.callCount, 1);
            await completion;
        });
        (0, mocha_1.it)('should appropriately reject result promises', async () => {
            const stub = sandbox
                .stub(fakeSubscriber.client, 'modifyAckDeadline')
                .resolves();
            const message = new FakeMessage();
            const completion = modAckQueue.add(message);
            await modAckQueue.flush();
            assert.strictEqual(stub.callCount, 1);
            await completion;
        });
    });
});
//# sourceMappingURL=message-queues.js.map