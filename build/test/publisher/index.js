"use strict";
/*!
 * Copyright 2019 Google LLC
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
const opentelemetry = require("@opentelemetry/api");
const q = require("../../src/publisher/message-queues");
const util = require("../../src/util");
const default_options_1 = require("../../src/default-options");
const tracing_1 = require("../tracing");
const api_1 = require("@opentelemetry/api");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
let promisified = false;
const fakeUtil = Object.assign({}, util, {
    promisifySome(class_, classProtos, methods, options) {
        if (class_.name === 'Publisher') {
            promisified = true;
            assert.deepStrictEqual(methods, ['flush', 'publishMessage']);
            assert.strictEqual(options.singular, true);
        }
        // Defeats the method name type check.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        util.promisifySome(class_, classProtos, methods, options);
    },
});
class FakeQueue extends events_1.EventEmitter {
    constructor(publisher) {
        super();
        this.publisher = publisher;
    }
    updateOptions() { }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    add(message, callback) { }
    publish(callback) {
        this._publish([], [], callback);
    }
    _publish(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    messages, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    callbacks, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    callback) { }
}
class FakeOrderedQueue extends FakeQueue {
    constructor(publisher, key) {
        super(publisher);
        this.orderingKey = key;
    }
    resumePublishing() { }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    publish(callback) {
        this._publish([], [], callback);
    }
    _publish(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    messages, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    callbacks, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    callback) { }
}
(0, mocha_1.describe)('Publisher', () => {
    let sandbox;
    let spy;
    const topic = {
        name: 'topic-name',
        pubsub: { projectId: 'PROJECT_ID' },
    };
    // tslint:disable-next-line variable-name
    let Publisher;
    let publisher;
    (0, mocha_1.beforeEach)(() => {
        sandbox = sinon.createSandbox();
        spy = sandbox.spy();
        const mocked = proxyquire('../../src/publisher/index.js', {
            '../util': fakeUtil,
            './message-queues': {
                Queue: FakeQueue,
                OrderedQueue: FakeOrderedQueue,
            },
        });
        Publisher = mocked.Publisher;
        publisher = new Publisher(topic);
    });
    (0, mocha_1.afterEach)(() => {
        sandbox.restore();
    });
    (0, mocha_1.describe)('initialization', () => {
        (0, mocha_1.it)('should promisify some of the things', () => {
            assert(promisified);
        });
        (0, mocha_1.it)('should capture user options', () => {
            const stub = sandbox.stub(Publisher.prototype, 'setOptions');
            const options = {};
            publisher = new Publisher(topic, options);
            assert.ok(stub.calledWith(options));
        });
        (0, mocha_1.it)('should localize topic instance', () => {
            assert.strictEqual(publisher.topic, topic);
        });
        (0, mocha_1.it)('should create a message queue', () => {
            assert(publisher.queue instanceof FakeQueue);
            assert.strictEqual(publisher.queue.publisher, publisher);
        });
        (0, mocha_1.it)('should create a map for ordered queues', () => {
            assert(publisher.orderedQueues instanceof Map);
        });
    });
    (0, mocha_1.describe)('publish', () => {
        const buffer = Buffer.from('Hello, world!');
        (0, mocha_1.it)('should call through to publishMessage', () => {
            const stub = sandbox.stub(publisher, 'publishMessage');
            publisher.publish(buffer, spy);
            const [{ data }, callback] = stub.lastCall.args;
            assert.strictEqual(data, buffer);
            assert.strictEqual(callback, spy);
        });
        (0, mocha_1.it)('should optionally accept attributes', () => {
            const stub = sandbox.stub(publisher, 'publishMessage');
            const attrs = {};
            publisher.publish(buffer, attrs, spy);
            const [{ attributes }, callback] = stub.lastCall.args;
            assert.strictEqual(attributes, attrs);
            assert.strictEqual(callback, spy);
        });
    });
    (0, mocha_1.describe)('OpenTelemetry tracing', () => {
        let tracingPublisher = {};
        const enableTracing = {
            enableOpenTelemetryTracing: true,
        };
        const buffer = Buffer.from('Hello, world!');
        (0, mocha_1.beforeEach)(() => {
            tracing_1.exporter.reset();
        });
        (0, mocha_1.it)('export created spans', () => {
            // Setup trace exporting
            tracingPublisher = new Publisher(topic, enableTracing);
            tracingPublisher.publish(buffer);
            const spans = tracing_1.exporter.getFinishedSpans();
            assert.notStrictEqual(spans.length, 0, 'has span');
            const createdSpan = spans.concat().pop();
            assert.strictEqual(createdSpan.status.code, opentelemetry.SpanStatusCode.UNSET);
            assert.strictEqual(createdSpan.attributes[semantic_conventions_1.SemanticAttributes.MESSAGING_OPERATION], 'send');
            assert.strictEqual(createdSpan.attributes[semantic_conventions_1.SemanticAttributes.MESSAGING_SYSTEM], 'pubsub');
            assert.strictEqual(createdSpan.attributes[semantic_conventions_1.SemanticAttributes.MESSAGING_DESTINATION], topic.name);
            assert.strictEqual(createdSpan.attributes[semantic_conventions_1.SemanticAttributes.MESSAGING_DESTINATION_KIND], 'topic');
            assert.strictEqual(createdSpan.name, 'topic-name send');
            assert.strictEqual(createdSpan.kind, api_1.SpanKind.PRODUCER, 'span kind should be PRODUCER');
            assert.ok(spans);
        });
    });
    (0, mocha_1.describe)('publishMessage', () => {
        const data = Buffer.from('hello, world!');
        (0, mocha_1.it)('should throw an error if data is not a Buffer', () => {
            const badData = {};
            assert.throws(() => publisher.publishMessage({ data: badData }, spy), /Data must be in the form of a Buffer\./);
        });
        (0, mocha_1.it)('should throw an error if data and attributes are both empty', () => {
            assert.throws(() => publisher.publishMessage({}, spy), /at least one attribute must be present/);
        });
        (0, mocha_1.it)('should allow sending only attributes', () => {
            const attributes = { foo: 'bar' };
            assert.doesNotThrow(() => publisher.publishMessage({ attributes }, spy));
        });
        (0, mocha_1.it)('should throw an error if attributes are wrong format', () => {
            const attributes = { foo: { bar: 'baz' } };
            assert.throws(() => publisher.publishMessage({ data, attributes }, spy), /All attributes must be in the form of a string.\n\nInvalid value of type "object" provided for "foo"\./);
        });
        (0, mocha_1.it)('should add non-ordered messages to the message queue', done => {
            const stub = sandbox.stub(publisher.queue, 'add');
            const fakeMessage = { data };
            publisher.publishMessage(fakeMessage, done);
            const [message, callback] = stub.lastCall.args;
            assert.strictEqual(message, fakeMessage);
            // Because of publisher flow control indirection, we have to test
            // the callback this way.
            callback(null);
        });
        (0, mocha_1.describe)('ordered messages', () => {
            const orderingKey = 'foo';
            const fakeMessage = { data, orderingKey };
            let queue;
            (0, mocha_1.beforeEach)(() => {
                queue = new FakeOrderedQueue(publisher, orderingKey);
                publisher.orderedQueues.set(orderingKey, queue);
            });
            (0, mocha_1.it)('should create a new queue for a message if need be', () => {
                publisher.orderedQueues.clear();
                publisher.publishMessage(fakeMessage, spy);
                queue = publisher.orderedQueues.get(orderingKey);
                assert(queue instanceof FakeOrderedQueue);
                assert.strictEqual(queue.publisher, publisher);
                assert.strictEqual(queue.orderingKey, orderingKey);
            });
            (0, mocha_1.it)('should add the ordered message to the correct queue', done => {
                const stub = sandbox.stub(queue, 'add');
                publisher.publishMessage(fakeMessage, done);
                // Because of publisher flow control indirection, we can't test
                // the callback here.
                const [message, callback] = stub.lastCall.args;
                assert.strictEqual(message, fakeMessage);
                // Because of publisher flow control indirection, we have to test
                // the callback this way.
                callback(null);
            });
            (0, mocha_1.it)('should return an error if the queue encountered an error', done => {
                const error = new Error('err');
                sandbox
                    .stub(queue, 'add')
                    .callsFake((message, callback) => callback(error));
                publisher.publishMessage(fakeMessage, err => {
                    assert.strictEqual(err, error);
                    done();
                });
            });
            (0, mocha_1.it)('should delete the queue once it is empty', () => {
                publisher.orderedQueues.clear();
                publisher.publishMessage(fakeMessage, spy);
                queue = publisher.orderedQueues.get(orderingKey);
                queue.emit('drain');
                assert.strictEqual(publisher.orderedQueues.size, 0);
            });
            (0, mocha_1.it)('should drain any ordered queues on flush', done => {
                // We have to stub out the regular queue as well, so that the flush() operation finishes.
                sandbox
                    .stub(FakeQueue.prototype, '_publish')
                    .callsFake((messages, callbacks, callback) => {
                    // Simulate the drain taking longer than the publishes. This can
                    // happen if more messages are queued during the publish().
                    process.nextTick(() => {
                        publisher.queue.emit('drain');
                    });
                    if (typeof callback === 'function')
                        callback(null);
                });
                sandbox
                    .stub(FakeOrderedQueue.prototype, '_publish')
                    .callsFake((messages, callbacks, callback) => {
                    const queue = publisher.orderedQueues.get(orderingKey);
                    // Simulate the drain taking longer than the publishes. This can
                    // happen on some ordered queue scenarios, especially if we have more
                    // than one queue to empty.
                    process.nextTick(() => {
                        queue.emit('drain');
                    });
                    if (typeof callback === 'function')
                        callback(null);
                });
                publisher.orderedQueues.clear();
                publisher.publishMessage(fakeMessage, spy);
                publisher.flush(err => {
                    assert.strictEqual(err, null);
                    assert.strictEqual(publisher.orderedQueues.size, 0);
                    done();
                });
            });
            (0, mocha_1.it)('should issue a warning if OpenTelemetry span context key is set', () => {
                const warnSpy = sinon.spy(console, 'warn');
                const attributes = {
                    googclient_OpenTelemetrySpanContext: 'foobar',
                };
                const fakeMessageWithOTKey = { data, attributes };
                const publisherTracing = new Publisher(topic, {
                    enableOpenTelemetryTracing: true,
                });
                publisherTracing.publishMessage(fakeMessageWithOTKey, warnSpy);
                assert.ok(warnSpy.called);
                warnSpy.restore();
            });
        });
    });
    (0, mocha_1.describe)('resumePublishing', () => {
        (0, mocha_1.it)('should resume publishing for the provided ordering key', () => {
            const orderingKey = 'foo';
            const queue = new FakeOrderedQueue(publisher, orderingKey);
            const stub = sandbox.stub(queue, 'resumePublishing');
            publisher.orderedQueues.set(orderingKey, queue);
            publisher.resumePublishing(orderingKey);
            assert.strictEqual(stub.callCount, 1);
        });
    });
    (0, mocha_1.describe)('setOptions', () => {
        (0, mocha_1.it)('should apply default values', () => {
            publisher.setOptions({});
            assert.deepStrictEqual(publisher.settings, {
                batching: {
                    maxBytes: default_options_1.defaultOptions.publish.maxOutstandingBytes,
                    maxMessages: default_options_1.defaultOptions.publish.maxOutstandingMessages,
                    maxMilliseconds: default_options_1.defaultOptions.publish.maxDelayMillis,
                },
                messageOrdering: false,
                gaxOpts: {
                    isBundling: false,
                },
                enableOpenTelemetryTracing: false,
                flowControlOptions: {
                    maxOutstandingBytes: undefined,
                    maxOutstandingMessages: undefined,
                },
            });
        });
        (0, mocha_1.it)('should capture user provided values', () => {
            const options = {
                batching: {
                    maxBytes: 10,
                    maxMessages: 10,
                    maxMilliseconds: 1,
                },
                messageOrdering: true,
                gaxOpts: {
                    isBundling: true,
                },
                enableOpenTelemetryTracing: true,
                flowControlOptions: {
                    maxOutstandingBytes: 500,
                    maxOutstandingMessages: 50,
                },
            };
            publisher.setOptions(options);
            assert.deepStrictEqual(publisher.settings, options);
        });
        (0, mocha_1.it)('should cap maxBytes at 9MB', () => {
            publisher.setOptions({
                batching: {
                    maxBytes: Math.pow(1024, 2) * 10,
                },
            });
            const expected = Math.pow(1024, 2) * 9;
            assert.strictEqual(publisher.settings.batching.maxBytes, expected);
        });
        (0, mocha_1.it)('should cap maxMessages at 1000', () => {
            publisher.setOptions({
                batching: {
                    maxMessages: 1001,
                },
            });
            assert.strictEqual(publisher.settings.batching.maxMessages, 1000);
        });
        (0, mocha_1.it)('should pass new option values into queues after construction', () => {
            // Make sure we have some ordering queues.
            publisher.orderedQueues.set('a', new q.OrderedQueue(publisher, 'a'));
            publisher.orderedQueues.set('b', new q.OrderedQueue(publisher, 'b'));
            const stubs = [sandbox.stub(publisher.queue, 'updateOptions')];
            assert.deepStrictEqual(publisher.orderedQueues.size, 2);
            stubs.push(...Array.from(publisher.orderedQueues.values()).map(q => sandbox.stub(q, 'updateOptions')));
            const newOptions = {
                batching: {},
            };
            publisher.setOptions(newOptions);
            stubs.forEach(s => assert.ok(s.calledOnce));
        });
    });
    (0, mocha_1.describe)('flush', () => {
        // The ordered queue drain test is above with the ordered queue tests.
        (0, mocha_1.it)('should drain the main publish queue', done => {
            sandbox
                .stub(publisher.queue, '_publish')
                .callsFake((messages, callbacks, callback) => {
                // Simulate the drain taking longer than the publishes. This can
                // happen if more messages are queued during the publish().
                process.nextTick(() => {
                    publisher.queue.emit('drain');
                });
                if (typeof callback === 'function')
                    callback(null);
            });
            publisher.flush(err => {
                assert.strictEqual(err, null);
                assert.strictEqual(!publisher.queue.batch || publisher.queue.batch.messages.length === 0, true);
                done();
            });
        });
    });
});
//# sourceMappingURL=index.js.map