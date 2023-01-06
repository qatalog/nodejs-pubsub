"use strict";
/*!
 * Copyright 2019 Google Inc. All Rights Reserved.
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
const proxyquire = require("proxyquire");
const sinon = require("sinon");
class FakeTopic {
    constructor() {
        this.name = 'fake-topic';
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    request(config, callback) { }
}
class FakeFlowControl {
}
class FakePublisher {
    constructor(topic) {
        this.topic = topic;
        this.settings = {
            batching: {},
        };
        this.flowControl = new FakeFlowControl();
    }
}
class FakeMessageBatch {
    constructor(options = {}) {
        this.callbacks = [];
        this.created = Date.now();
        this.messages = [];
        this.options = options;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    add(message, callback) { }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    canFit(message) {
        return true;
    }
    isAtMax() {
        return false;
    }
    isFull() {
        return false;
    }
    setOptions(options) {
        this.options = options;
    }
}
class FakePublishError {
    constructor(key, error) {
        this.orderingKey = key;
        this.error = error;
    }
}
(0, mocha_1.describe)('Message Queues', () => {
    const sandbox = sinon.createSandbox();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let MessageQueue;
    let Queue;
    let OrderedQueue;
    let topic;
    let publisher;
    (0, mocha_1.before)(() => {
        const mocked = proxyquire('../../src/publisher/message-queues.js', {
            './message-batch': { MessageBatch: FakeMessageBatch },
            './publish-error': { PublishError: FakePublishError },
        });
        MessageQueue = mocked.MessageQueue;
        Queue = mocked.Queue;
        OrderedQueue = mocked.OrderedQueue;
    });
    (0, mocha_1.beforeEach)(() => {
        topic = new FakeTopic();
        publisher = new FakePublisher(topic);
    });
    (0, mocha_1.afterEach)(() => {
        sandbox.restore();
    });
    (0, mocha_1.describe)('MessageQueue', () => {
        let queue;
        (0, mocha_1.beforeEach)(() => {
            queue = new MessageQueue(publisher);
        });
        (0, mocha_1.describe)('initialization', () => {
            (0, mocha_1.it)('should extend EventEmitter', () => {
                assert(queue instanceof events_1.EventEmitter);
            });
            (0, mocha_1.it)('should localize the publisher', () => {
                assert.strictEqual(queue.publisher, publisher);
            });
            (0, mocha_1.it)('should localize the batch options', () => {
                const batching = { maxMessages: 1001 };
                publisher.settings = { batching };
                queue = new MessageQueue(publisher);
                assert.strictEqual(queue.batchOptions, batching);
            });
        });
        (0, mocha_1.describe)('_publish', () => {
            const messages = [{}, {}, {}];
            const callbacks = messages.map(() => sandbox.spy());
            (0, mocha_1.it)('should make the correct request', () => {
                const stub = sandbox.stub(topic, 'request');
                queue._publish(messages, callbacks);
                const [{ client, method, reqOpts }] = stub.lastCall.args;
                assert.strictEqual(client, 'PublisherClient');
                assert.strictEqual(method, 'publish');
                assert.deepStrictEqual(reqOpts, { topic: topic.name, messages });
            });
            (0, mocha_1.it)('should pass along any gax options', () => {
                const stub = sandbox.stub(topic, 'request');
                const callOptions = {};
                publisher.settings.gaxOpts = callOptions;
                queue._publish(messages, callbacks);
                const [{ gaxOpts }] = stub.lastCall.args;
                assert.strictEqual(gaxOpts, callOptions);
            });
            (0, mocha_1.it)('should pass back any request errors', done => {
                const error = new Error('err');
                sandbox.stub(topic, 'request').callsFake((config, callback) => {
                    callback(error);
                });
                queue._publish(messages, callbacks, err => {
                    assert.strictEqual(err, error);
                    callbacks.forEach(callback => {
                        const [err] = callback.lastCall.args;
                        assert.strictEqual(err, error);
                    });
                    done();
                });
            });
            (0, mocha_1.it)('should pass back message ids', done => {
                const messageIds = messages.map((_, i) => `message${i}`);
                sandbox.stub(topic, 'request').callsFake((config, callback) => {
                    callback(null, { messageIds });
                });
                queue._publish(messages, callbacks, err => {
                    assert.ifError(err);
                    callbacks.forEach((callback, i) => {
                        const [, messageId] = callback.lastCall.args;
                        const expectedId = `message${i}`;
                        assert.strictEqual(messageId, expectedId);
                    });
                    done();
                });
            });
        });
    });
    (0, mocha_1.describe)('Queue', () => {
        let queue;
        (0, mocha_1.beforeEach)(() => {
            queue = new Queue(publisher);
        });
        (0, mocha_1.describe)('initialization', () => {
            (0, mocha_1.it)('should create a message batch', () => {
                assert.ok(queue.batch instanceof FakeMessageBatch);
                assert.strictEqual(queue.batch.options, queue.batchOptions);
            });
            (0, mocha_1.it)('should propagate batch options to the message batch when updated', () => {
                const newConfig = {
                    batching: {},
                };
                publisher.settings = newConfig;
                queue.updateOptions();
                assert.strictEqual(queue.batch.options, newConfig.batching);
            });
        });
        (0, mocha_1.describe)('add', () => {
            const spy = sandbox.spy();
            const fakeMessage = {};
            (0, mocha_1.it)('should publish immediately if unable to fit message', done => {
                const addStub = sandbox.stub(queue.batch, 'add');
                sandbox.stub(queue.batch, 'canFit').returns(false);
                sandbox
                    .stub(queue, 'publish')
                    .onCall(0)
                    .callsFake(() => {
                    assert.strictEqual(addStub.callCount, 0);
                    done();
                });
                queue.add(fakeMessage, spy);
            });
            (0, mocha_1.it)('should add the message to the batch', () => {
                const stub = sandbox.stub(queue.batch, 'add');
                sandbox.stub(queue, 'publish');
                queue.add(fakeMessage, spy);
                const [message, callback] = stub.lastCall.args;
                assert.strictEqual(message, fakeMessage);
                assert.strictEqual(callback, spy);
            });
            (0, mocha_1.it)('should publish immediately if the batch became full', () => {
                const stub = sandbox.stub(queue, 'publish');
                sandbox.stub(queue.batch, 'isFull').returns(true);
                queue.add(fakeMessage, spy);
                assert.strictEqual(stub.callCount, 1);
            });
            (0, mocha_1.it)('should set a timeout to publish if need be', () => {
                const clock = sandbox.useFakeTimers();
                const stub = sandbox.stub(queue, 'publish');
                const maxMilliseconds = 1234;
                queue.batchOptions = { maxMilliseconds };
                queue.add(fakeMessage, spy);
                assert.strictEqual(stub.callCount, 0);
                clock.tick(maxMilliseconds);
                assert.strictEqual(stub.callCount, 1);
                clock.restore();
            });
            (0, mocha_1.it)('should noop if a timeout is already set', () => {
                const clock = sandbox.useFakeTimers();
                const stub = sandbox.stub(queue, 'publish');
                const maxMilliseconds = 1234;
                queue.batchOptions = { maxMilliseconds };
                queue.pending = 1234;
                queue.add(fakeMessage, spy);
                clock.tick(maxMilliseconds);
                assert.strictEqual(stub.callCount, 0);
                clock.restore();
            });
        });
        (0, mocha_1.describe)('publish', () => {
            (0, mocha_1.it)('should create a new batch', () => {
                const oldBatch = queue.batch;
                queue.publish();
                assert.notStrictEqual(oldBatch, queue.batch);
                assert.ok(queue.batch instanceof FakeMessageBatch);
                assert.strictEqual(queue.batch.options, queue.batchOptions);
            });
            (0, mocha_1.it)('should cancel any pending publish calls', () => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fakeHandle = 1234;
                const stub = sandbox.stub(global, 'clearTimeout').withArgs(fakeHandle);
                queue.pending = fakeHandle;
                queue.publish();
                assert.strictEqual(stub.callCount, 1);
                assert.strictEqual(queue.pending, undefined);
            });
            (0, mocha_1.it)('should publish the messages', () => {
                const batch = queue.batch;
                const stub = sandbox.stub(queue, '_publish');
                queue.publish();
                const [messages, callbacks] = stub.lastCall.args;
                assert.strictEqual(messages, batch.messages);
                assert.strictEqual(callbacks, batch.callbacks);
            });
        });
    });
    (0, mocha_1.describe)('OrderedQueue', () => {
        const key = 'abcd';
        let queue;
        (0, mocha_1.beforeEach)(() => {
            queue = new OrderedQueue(publisher, key);
        });
        (0, mocha_1.describe)('initialization', () => {
            (0, mocha_1.it)('should create an array of batches', () => {
                assert.deepStrictEqual(queue.batches, []);
            });
            (0, mocha_1.it)('should default inFlight ot false', () => {
                assert.strictEqual(queue.inFlight, false);
            });
            (0, mocha_1.it)('should localize the ordering key', () => {
                assert.strictEqual(queue.key, key);
            });
            (0, mocha_1.it)('should propagate batch options to all message batches when updated', () => {
                const firstBatch = queue.createBatch();
                const secondBatch = queue.createBatch();
                queue.batches.push(firstBatch, secondBatch);
                const newConfig = {
                    batching: {},
                };
                publisher.settings = newConfig;
                queue.updateOptions();
                assert.strictEqual(firstBatch.options, newConfig.batching);
                assert.strictEqual(secondBatch.options, newConfig.batching);
            });
        });
        (0, mocha_1.describe)('currentBatch', () => {
            (0, mocha_1.it)('should return the oldest known batch', () => {
                const batches = [
                    new FakeMessageBatch(),
                    new FakeMessageBatch(),
                ];
                queue.batches.push(...batches);
                assert.strictEqual(queue.currentBatch, batches[0]);
            });
            (0, mocha_1.it)('should create a new batch if one does not exist', () => {
                assert.strictEqual(queue.batches.length, 0);
                assert.ok(queue.currentBatch instanceof FakeMessageBatch);
                assert.strictEqual(queue.batches.length, 1);
            });
        });
        (0, mocha_1.describe)('add', () => {
            const fakeMessage = {};
            const spy = sandbox.spy();
            let batch;
            (0, mocha_1.beforeEach)(() => {
                batch = queue.currentBatch;
            });
            (0, mocha_1.describe)('with batch in flight', () => {
                (0, mocha_1.beforeEach)(() => {
                    queue.inFlight = true;
                });
                (0, mocha_1.it)('should add the message to current batch', () => {
                    const stub = sandbox.stub(batch, 'add');
                    queue.add(fakeMessage, spy);
                    const [message, callback] = stub.lastCall.args;
                    assert.strictEqual(message, fakeMessage);
                    assert.strictEqual(callback, spy);
                });
                (0, mocha_1.it)('should create a new batch if current one is at max', () => {
                    const fakeBatch = new FakeMessageBatch();
                    const stub = sandbox.stub(fakeBatch, 'add');
                    sandbox.stub(batch, 'isAtMax').returns(true);
                    sandbox.stub(queue, 'createBatch').returns(fakeBatch);
                    queue.add(fakeMessage, spy);
                    assert.deepStrictEqual(queue.batches, [fakeBatch, batch]);
                    const [message, callback] = stub.lastCall.args;
                    assert.strictEqual(message, fakeMessage);
                    assert.strictEqual(callback, spy);
                });
            });
            (0, mocha_1.describe)('without a batch in flight', () => {
                (0, mocha_1.it)('should publish immediately if it cannot fit the message', done => {
                    const addStub = sandbox.stub(batch, 'add');
                    sandbox.stub(batch, 'canFit').withArgs(fakeMessage).returns(false);
                    sandbox
                        .stub(queue, 'publish')
                        .onCall(0)
                        .callsFake(() => {
                        assert.strictEqual(addStub.callCount, 0);
                        done();
                    });
                    queue.add(fakeMessage, spy);
                });
                (0, mocha_1.it)('should add the message to the current batch', () => {
                    const stub = sandbox.stub(batch, 'add');
                    queue.add(fakeMessage, spy);
                    const [message, callback] = stub.lastCall.args;
                    assert.strictEqual(message, fakeMessage);
                    assert.strictEqual(callback, spy);
                });
                (0, mocha_1.it)('should noop after adding if a publish was triggered', () => {
                    const publishStub = sandbox.stub(queue, 'publish');
                    const beginPublishStub = sandbox.stub(queue, 'beginNextPublish');
                    sandbox.stub(batch, 'canFit').returns(false);
                    publishStub.onCall(0).callsFake(() => {
                        queue.inFlight = true;
                    });
                    queue.add(fakeMessage, spy);
                    assert.strictEqual(publishStub.callCount, 1);
                    assert.strictEqual(beginPublishStub.callCount, 0);
                });
                (0, mocha_1.it)('should publish immediately if the batch is full', () => {
                    const stub = sandbox.stub(queue, 'publish');
                    sandbox.stub(batch, 'isFull').returns(true);
                    queue.add(fakeMessage, spy);
                    assert.strictEqual(stub.callCount, 1);
                });
                (0, mocha_1.it)('should schedule a publish if one is not pending', () => {
                    const stub = sandbox.stub(queue, 'beginNextPublish');
                    queue.add(fakeMessage, spy);
                    assert.strictEqual(stub.callCount, 1);
                });
                (0, mocha_1.it)('should noop after adding if a publish is already pending', () => {
                    const stub = sandbox.stub(queue, 'beginNextPublish');
                    queue.pending = 1234;
                    queue.add(fakeMessage, spy);
                    assert.strictEqual(stub.callCount, 0);
                });
            });
        });
        (0, mocha_1.describe)('beginNextPublish', () => {
            const maxMilliseconds = 10000;
            let clock;
            (0, mocha_1.beforeEach)(() => {
                queue.batchOptions = { maxMilliseconds };
                clock = sinon.useFakeTimers();
            });
            (0, mocha_1.afterEach)(() => {
                clock.restore();
            });
            (0, mocha_1.it)('should set a timeout that will call publish', done => {
                sandbox.stub(queue, 'publish').callsFake(done);
                queue.beginNextPublish();
                clock.tick(maxMilliseconds);
            });
            (0, mocha_1.it)('should factor in the time the batch has been sitting', done => {
                const halfway = maxMilliseconds / 2;
                sandbox.stub(queue, 'publish').callsFake(done);
                queue.currentBatch.created = Date.now() - halfway;
                queue.beginNextPublish();
                clock.tick(halfway);
            });
            (0, mocha_1.it)('should not set a timeout with a negative number', () => {
                const stub = sandbox.stub(global, 'setTimeout');
                queue.currentBatch.created = Date.now() - maxMilliseconds * 2;
                queue.beginNextPublish();
                const [, delay] = stub.lastCall.args;
                assert.strictEqual(delay, 0);
            });
        });
        (0, mocha_1.describe)('createBatch', () => {
            (0, mocha_1.it)('should create a batch with the correct options', () => {
                const batchOptions = {};
                queue.batchOptions = batchOptions;
                const batch = queue.createBatch();
                assert.ok(batch instanceof FakeMessageBatch);
                assert.strictEqual(batch.options, batchOptions);
            });
        });
        (0, mocha_1.describe)('handlePublishFailure', () => {
            const error = new Error('err');
            (0, mocha_1.it)('should localize the publish error', () => {
                queue.handlePublishFailure(error);
                assert.ok(queue.error instanceof FakePublishError);
                assert.strictEqual(queue.error.orderingKey, key);
                assert.strictEqual(queue.error.error, error);
            });
            (0, mocha_1.it)('should pass the error to call pending callbacks', () => {
                const spies = [sandbox.spy(), sandbox.spy()];
                queue.currentBatch.callbacks = spies;
                queue.handlePublishFailure(error);
                assert.strictEqual(queue.batches.length, 0);
                spies.forEach(spy => {
                    assert.ok(spy.calledWith(error));
                });
            });
        });
        (0, mocha_1.describe)('publish', () => {
            const fakeMessages = [{}, {}];
            const spies = [sandbox.spy(), sandbox.spy()];
            (0, mocha_1.beforeEach)(() => {
                queue.currentBatch.messages = fakeMessages;
                queue.currentBatch.callbacks = spies;
            });
            (0, mocha_1.it)('should set inFlight to true', () => {
                queue.publish();
                assert.strictEqual(queue.inFlight, true);
            });
            (0, mocha_1.it)('should cancel any pending publishes', () => {
                const fakeHandle = 1234;
                const stub = sandbox.stub(global, 'clearTimeout');
                queue.pending = fakeHandle;
                queue.publish();
                const [handle] = stub.lastCall.args;
                assert.strictEqual(handle, fakeHandle);
                assert.strictEqual(queue.pending, undefined);
            });
            (0, mocha_1.it)('should remove the oldest batch from the batch list', () => {
                const oldestBatch = queue.currentBatch;
                queue.publish();
                assert.notStrictEqual(queue.currentBatch, oldestBatch);
            });
            (0, mocha_1.it)('should publish the batch', () => {
                const stub = sandbox.stub(queue, '_publish');
                queue.publish();
                const [messages, callbacks] = stub.lastCall.args;
                assert.strictEqual(messages, fakeMessages);
                assert.strictEqual(callbacks, spies);
            });
            (0, mocha_1.it)('should set inFlight to false after publishing', () => {
                sandbox.stub(queue, '_publish').callsFake((m, c, done) => done(null));
                queue.publish();
                assert.strictEqual(queue.inFlight, false);
            });
            (0, mocha_1.it)('should handle any publish failures', () => {
                const error = new Error('err');
                const stub = sandbox.stub(queue, 'handlePublishFailure');
                sandbox.stub(queue, '_publish').callsFake((m, c, done) => done(error));
                queue.publish();
                const [err] = stub.lastCall.args;
                assert.strictEqual(err, error);
            });
            (0, mocha_1.it)('should begin another publish if there are pending batches', () => {
                const stub = sandbox.stub(queue, 'beginNextPublish');
                sandbox.stub(queue, '_publish').callsFake((m, c, done) => done(null));
                const secondBatch = new FakeMessageBatch();
                secondBatch.messages = fakeMessages;
                secondBatch.callbacks = spies;
                queue.batches.push(secondBatch);
                queue.publish();
                assert.strictEqual(stub.callCount, 1);
            });
            (0, mocha_1.it)('should emit "drain" if there is nothing left to publish', () => {
                const spy = sandbox.spy();
                sandbox.stub(queue, '_publish').callsFake((m, c, done) => done(null));
                queue.on('drain', spy);
                queue.publish();
                assert.strictEqual(spy.callCount, 1);
            });
        });
        (0, mocha_1.describe)('resumePublishing', () => {
            const error = new Error('err');
            (0, mocha_1.beforeEach)(() => {
                queue.error = error;
            });
            (0, mocha_1.it)('should delete the cached publish error', () => {
                queue.resumePublishing();
                assert.strictEqual(queue.error, undefined);
            });
            (0, mocha_1.it)('should emit the drain event if there are no more batches', done => {
                queue.on('drain', done);
                queue.resumePublishing();
            });
            (0, mocha_1.it)('should not emit the drain event if publishing continues', done => {
                queue.on('drain', () => done(new Error('Should not be called.')));
                queue.resumePublishing();
                assert.ok(queue.currentBatch);
                process.nextTick(() => done());
            });
        });
    });
});
//# sourceMappingURL=message-queues.js.map