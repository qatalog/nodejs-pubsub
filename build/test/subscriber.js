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
const tracing_1 = require("./tracing");
const assert = require("assert");
const mocha_1 = require("mocha");
const events_1 = require("events");
const proxyquire = require("proxyquire");
const sinon = require("sinon");
const stream_1 = require("stream");
const uuid = require("uuid");
const opentelemetry = require("@opentelemetry/api");
const s = require("../src/subscriber");
const api_1 = require("@opentelemetry/api");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const src_1 = require("../src");
const stubs = new Map();
class FakeClient {
}
class FakePubSub {
    constructor() {
        this.client = new FakeClient();
    }
    getClient_(options, callback) {
        callback(null, this.client);
    }
}
class FakeSubscription {
    constructor() {
        this.name = uuid.v4();
        this.projectId = uuid.v4();
        this.pubsub = new FakePubSub();
    }
}
class FakeHistogram {
    constructor(options) {
        this.options = options;
        const key = options ? 'histogram' : 'latencies';
        stubs.set(key, this);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    add(seconds) { }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    percentile(percentile) {
        return 10;
    }
}
class FakeLeaseManager extends events_1.EventEmitter {
    constructor(sub, options) {
        super();
        this.options = options;
        stubs.set('inventory', this);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    add(message) { }
    clear() { }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    remove(message) { }
}
class FakeQueue {
    constructor(sub, options) {
        this.numPendingRequests = 0;
        this.numInFlightRequests = 0;
        this.maxMilliseconds = 100;
        this.options = options;
    }
    close() { }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async add(message, deadline) {
        return s.AckResponses.Success;
    }
    async flush() { }
    async onFlush() { }
    async onDrain() { }
}
class FakeAckQueue extends FakeQueue {
    constructor(sub, options) {
        super(sub, options);
        stubs.set('ackQueue', this);
    }
}
class FakeModAckQueue extends FakeQueue {
    constructor(sub, options) {
        super(sub, options);
        stubs.set('modAckQueue', this);
    }
}
class FakeMessageStream extends stream_1.PassThrough {
    constructor(sub, options) {
        super({ objectMode: true });
        this.options = options;
        stubs.set('messageStream', this);
    }
    _destroy(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _error, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _callback) { }
}
class FakePreciseDate {
    constructor(date) {
        this.value = date;
    }
}
const RECEIVED_MESSAGE = {
    ackId: uuid.v4(),
    message: {
        attributes: {},
        data: Buffer.from('Hello, world!'),
        messageId: uuid.v4(),
        orderingKey: 'ordering-key',
        publishTime: { seconds: 12, nanos: 32 },
    },
};
(0, mocha_1.describe)('Subscriber', () => {
    let sandbox;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fakeProjectify;
    let subscription;
    // tslint:disable-next-line variable-name
    let Message;
    let message;
    // tslint:disable-next-line variable-name
    let Subscriber;
    let subscriber;
    (0, mocha_1.beforeEach)(() => {
        sandbox = sinon.createSandbox();
        fakeProjectify = {
            replaceProjectIdToken: sandbox.stub().callsFake((name, projectId) => {
                return `projects/${projectId}/name/${name}`;
            }),
        };
        const s = proxyquire('../src/subscriber.js', {
            '@google-cloud/precise-date': { PreciseDate: FakePreciseDate },
            '@google-cloud/projectify': fakeProjectify,
            './histogram': { Histogram: FakeHistogram },
            './lease-manager': { LeaseManager: FakeLeaseManager },
            './message-queues': {
                AckQueue: FakeAckQueue,
                ModAckQueue: FakeModAckQueue,
            },
            './message-stream': { MessageStream: FakeMessageStream },
        });
        Message = s.Message;
        Subscriber = s.Subscriber;
        // Create standard instance
        subscription = new FakeSubscription();
        subscriber = new Subscriber(subscription);
        message = new Message(subscriber, RECEIVED_MESSAGE);
        subscriber.open();
    });
    (0, mocha_1.afterEach)(() => {
        sandbox.restore();
        subscriber.close();
    });
    (0, mocha_1.describe)('initialization', () => {
        (0, mocha_1.it)('should default ackDeadline to 10', () => {
            assert.strictEqual(subscriber.ackDeadline, 10);
        });
        (0, mocha_1.it)('should default maxMessages to 1000', () => {
            assert.strictEqual(subscriber.maxMessages, 1000);
        });
        (0, mocha_1.it)('should default maxBytes to 100MB', () => {
            assert.strictEqual(subscriber.maxBytes, 100 * 1024 * 1024);
        });
        (0, mocha_1.it)('should set isOpen to false', () => {
            const s = new Subscriber(subscription);
            assert.strictEqual(s.isOpen, false);
        });
        (0, mocha_1.it)('should set any options passed in', () => {
            const stub = sandbox.stub(Subscriber.prototype, 'setOptions');
            const fakeOptions = {};
            new Subscriber(subscription, fakeOptions);
            const [options] = stub.lastCall.args;
            assert.strictEqual(options, fakeOptions);
        });
    });
    (0, mocha_1.describe)('modAckLatency', () => {
        (0, mocha_1.it)('should get the 99th percentile latency', () => {
            const latencies = stubs.get('latencies');
            const fakeLatency = 234;
            sandbox.stub(latencies, 'percentile').withArgs(99).returns(fakeLatency);
            const maxMilliseconds = stubs.get('modAckQueue').maxMilliseconds;
            const expectedLatency = fakeLatency * 1000 + maxMilliseconds;
            assert.strictEqual(subscriber.modAckLatency, expectedLatency);
        });
    });
    (0, mocha_1.describe)('name', () => {
        (0, mocha_1.it)('should replace the project id token', () => {
            const fakeName = 'abcd';
            fakeProjectify.replaceProjectIdToken
                .withArgs(subscription.name, subscription.projectId)
                .returns(fakeName);
            const name = subscriber.name;
            assert.strictEqual(name, fakeName);
        });
        (0, mocha_1.it)('should cache the name', () => {
            const fakeName = 'abcd';
            const stub = fakeProjectify.replaceProjectIdToken
                .withArgs(subscription.name, subscription.projectId)
                .returns(fakeName);
            const name = subscriber.name;
            assert.strictEqual(name, fakeName);
            const name2 = subscriber.name;
            assert.strictEqual(name, name2);
            assert.strictEqual(stub.callCount, 1);
        });
    });
    (0, mocha_1.describe)('ack', () => {
        (0, mocha_1.it)('should update the ack histogram/deadline', () => {
            const histogram = stubs.get('histogram');
            const now = Date.now();
            message.received = 23842328;
            sandbox.stub(global.Date, 'now').returns(now);
            const expectedSeconds = (now - message.received) / 1000;
            const addStub = sandbox.stub(histogram, 'add').withArgs(expectedSeconds);
            const fakeDeadline = 598;
            sandbox.stub(histogram, 'percentile').withArgs(99).returns(fakeDeadline);
            subscriber.ack(message);
            assert.strictEqual(addStub.callCount, 1);
            assert.strictEqual(subscriber.ackDeadline, fakeDeadline);
        });
        (0, mocha_1.it)('should bound ack deadlines if min/max are specified', () => {
            const histogram = stubs.get('histogram');
            const now = Date.now();
            message.received = 23842328;
            sandbox.stub(global.Date, 'now').returns(now);
            const expectedSeconds = (now - message.received) / 1000;
            const addStub = sandbox.stub(histogram, 'add').withArgs(expectedSeconds);
            let fakeDeadline = 312123;
            sandbox
                .stub(histogram, 'percentile')
                .withArgs(99)
                .callsFake(() => fakeDeadline);
            subscriber.setOptions({
                maxAckDeadline: src_1.Duration.from({ seconds: 60 }),
            });
            subscriber.ack(message);
            assert.strictEqual(addStub.callCount, 1);
            assert.strictEqual(subscriber.ackDeadline, 60);
            subscriber.setOptions({
                minAckDeadline: src_1.Duration.from({ seconds: 10 }),
            });
            fakeDeadline = 1;
            subscriber.ack(message);
            assert.strictEqual(subscriber.ackDeadline, 10);
        });
        (0, mocha_1.it)('should default to 60s min for exactly-once delivery subscriptions', () => {
            subscriber.subscriptionProperties = { exactlyOnceDeliveryEnabled: true };
            const histogram = stubs.get('histogram');
            const now = Date.now();
            message.received = 23842328;
            sandbox.stub(global.Date, 'now').returns(now);
            const expectedSeconds = (now - message.received) / 1000;
            const addStub = sandbox.stub(histogram, 'add').withArgs(expectedSeconds);
            const fakeDeadline = 10;
            sandbox.stub(histogram, 'percentile').withArgs(99).returns(fakeDeadline);
            subscriber.ack(message);
            assert.strictEqual(addStub.callCount, 1);
            assert.strictEqual(subscriber.ackDeadline, 60);
            // Also check that if we set a different min, it's honoured.
            subscriber.setOptions({
                minAckDeadline: src_1.Duration.from({ seconds: 5 }),
            });
            subscriber.ack(message);
            assert.strictEqual(subscriber.ackDeadline, 10);
        });
        (0, mocha_1.it)('should not update the deadline if user specified', () => {
            const histogram = stubs.get('histogram');
            const ackDeadline = 543;
            const maxMessages = 20;
            const maxBytes = 20000;
            sandbox.stub(histogram, 'add').throws();
            sandbox.stub(histogram, 'percentile').throws();
            subscriber.setOptions({
                ackDeadline,
                flowControl: { maxMessages: maxMessages, maxBytes: maxBytes },
            });
            subscriber.ack(message);
            assert.strictEqual(subscriber.ackDeadline, ackDeadline);
        });
        (0, mocha_1.it)('should add the message to the ack queue', () => {
            const ackQueue = stubs.get('ackQueue');
            const stub = sandbox.stub(ackQueue, 'add').withArgs(message);
            subscriber.ack(message);
            assert.strictEqual(stub.callCount, 1);
        });
        (0, mocha_1.it)('should remove the message from inv. after queue flushes', done => {
            const ackQueue = stubs.get('ackQueue');
            const inventory = stubs.get('inventory');
            const onFlushStub = sandbox.stub(ackQueue, 'onFlush').resolves();
            sandbox
                .stub(inventory, 'remove')
                .withArgs(message)
                .callsFake(() => {
                assert.strictEqual(onFlushStub.callCount, 1);
                done();
            });
            subscriber.ack(message);
        });
    });
    (0, mocha_1.describe)('close', () => {
        (0, mocha_1.it)('should noop if not open', () => {
            const s = new Subscriber(subscription);
            const stream = stubs.get('messageStream');
            sandbox
                .stub(stream, 'destroy')
                .rejects(new Error('should not be called.'));
            return s.close();
        });
        (0, mocha_1.it)('should set isOpen to false', () => {
            subscriber.close();
            assert.strictEqual(subscriber.isOpen, false);
        });
        (0, mocha_1.it)('should destroy the message stream', () => {
            const stream = stubs.get('messageStream');
            const stub = sandbox.stub(stream, 'destroy');
            subscriber.close();
            assert.strictEqual(stub.callCount, 1);
        });
        (0, mocha_1.it)('should clear the inventory', () => {
            const inventory = stubs.get('inventory');
            const stub = sandbox.stub(inventory, 'clear');
            subscriber.close();
            assert.strictEqual(stub.callCount, 1);
        });
        (0, mocha_1.it)('should emit a close event', done => {
            subscriber.on('close', done);
            subscriber.close();
        });
        (0, mocha_1.it)('should nack any messages that come in after', () => {
            const stream = stubs.get('messageStream');
            const stub = sandbox.stub(subscriber, 'nack');
            const pullResponse = { receivedMessages: [RECEIVED_MESSAGE] };
            subscriber.close();
            stream.emit('data', pullResponse);
            const [{ ackId }] = stub.lastCall.args;
            assert.strictEqual(ackId, RECEIVED_MESSAGE.ackId);
        });
        (0, mocha_1.describe)('flushing the queues', () => {
            (0, mocha_1.it)('should wait for any pending acks', async () => {
                const ackQueue = stubs.get('ackQueue');
                const ackOnFlush = sandbox.stub(ackQueue, 'onFlush').resolves();
                const acksFlush = sandbox.stub(ackQueue, 'flush').resolves();
                ackQueue.numPendingRequests = 1;
                await subscriber.close();
                assert.strictEqual(ackOnFlush.callCount, 1);
                assert.strictEqual(acksFlush.callCount, 1);
            });
            (0, mocha_1.it)('should wait for any pending modAcks', async () => {
                const modAckQueue = stubs.get('modAckQueue');
                const modAckOnFlush = sandbox.stub(modAckQueue, 'onFlush').resolves();
                const modAckFlush = sandbox.stub(modAckQueue, 'flush').resolves();
                modAckQueue.numPendingRequests = 1;
                await subscriber.close();
                assert.strictEqual(modAckOnFlush.callCount, 1);
                assert.strictEqual(modAckFlush.callCount, 1);
            });
            (0, mocha_1.it)('should resolve if no messages are pending', () => {
                const ackQueue = stubs.get('ackQueue');
                sandbox.stub(ackQueue, 'flush').rejects();
                sandbox.stub(ackQueue, 'onFlush').rejects();
                sandbox.stub(ackQueue, 'onDrain').rejects();
                const modAckQueue = stubs.get('modAckQueue');
                sandbox.stub(modAckQueue, 'flush').rejects();
                sandbox.stub(modAckQueue, 'onFlush').rejects();
                return subscriber.close();
            });
            (0, mocha_1.it)('should wait for in-flight messages to drain', async () => {
                const ackQueue = stubs.get('ackQueue');
                const modAckQueue = stubs.get('modAckQueue');
                const ackOnDrain = sandbox.stub(ackQueue, 'onDrain').resolves();
                const modAckOnDrain = sandbox.stub(modAckQueue, 'onDrain').resolves();
                ackQueue.numInFlightRequests = 1;
                modAckQueue.numInFlightRequests = 1;
                await subscriber.close();
                assert.strictEqual(ackOnDrain.callCount, 1);
                assert.strictEqual(modAckOnDrain.callCount, 1);
            });
        });
    });
    (0, mocha_1.describe)('getClient', () => {
        (0, mocha_1.it)('should get a subscriber client', async () => {
            const pubsub = subscription.pubsub;
            const spy = sandbox.spy(pubsub, 'getClient_');
            const client = await subscriber.getClient();
            const [options] = spy.lastCall.args;
            assert.deepStrictEqual(options, { client: 'SubscriberClient' });
            assert.strictEqual(client, pubsub.client);
        });
    });
    (0, mocha_1.describe)('modAck', () => {
        const deadline = 600;
        (0, mocha_1.it)('should add the message/deadline to the modAck queue', () => {
            const modAckQueue = stubs.get('modAckQueue');
            const stub = sandbox.stub(modAckQueue, 'add').withArgs(message, deadline);
            subscriber.modAck(message, deadline);
            assert.strictEqual(stub.callCount, 1);
        });
        (0, mocha_1.it)('should capture latency after queue flush', async () => {
            const modAckQueue = stubs.get('modAckQueue');
            const latencies = stubs.get('latencies');
            const start = 1232123;
            const end = 34838243;
            const expectedSeconds = (end - start) / 1000;
            const dateStub = sandbox.stub(global.Date, 'now');
            dateStub.onCall(0).returns(start);
            dateStub.onCall(1).returns(end);
            sandbox.stub(modAckQueue, 'onFlush').resolves();
            const addStub = sandbox.stub(latencies, 'add').withArgs(expectedSeconds);
            await subscriber.modAck(message, deadline);
            assert.strictEqual(addStub.callCount, 1);
        });
    });
    (0, mocha_1.describe)('nack', () => {
        (0, mocha_1.it)('should modAck the message with a 0 deadline', async () => {
            const stub = sandbox.stub(subscriber, 'modAck');
            await subscriber.nack(message);
            const [msg, deadline] = stub.lastCall.args;
            assert.strictEqual(msg, message);
            assert.strictEqual(deadline, 0);
        });
        (0, mocha_1.it)('should remove the message from the inventory', async () => {
            const inventory = stubs.get('inventory');
            const stub = sandbox.stub(inventory, 'remove').withArgs(message);
            await subscriber.nack(message);
            assert.strictEqual(stub.callCount, 1);
        });
    });
    (0, mocha_1.describe)('open', () => {
        (0, mocha_1.beforeEach)(() => subscriber.close());
        (0, mocha_1.it)('should pass in batching options', () => {
            const batching = { maxMessages: 100 };
            subscriber.setOptions({ batching });
            subscriber.open();
            const ackQueue = stubs.get('ackQueue');
            const modAckQueue = stubs.get('modAckQueue');
            assert.strictEqual(ackQueue.options, batching);
            assert.strictEqual(modAckQueue.options, batching);
        });
        (0, mocha_1.it)('should pass in flow control options', () => {
            const flowControl = { maxMessages: 100 };
            subscriber.setOptions({ flowControl });
            subscriber.open();
            const inventory = stubs.get('inventory');
            assert.strictEqual(inventory.options, flowControl);
        });
        (0, mocha_1.it)('should pass in streaming options', () => {
            const streamingOptions = { maxStreams: 3 };
            subscriber.setOptions({ streamingOptions });
            subscriber.open();
            const stream = stubs.get('messageStream');
            assert.strictEqual(stream.options, streamingOptions);
        });
        (0, mocha_1.it)('should emit stream errors', done => {
            subscriber.open();
            const stream = stubs.get('messageStream');
            const fakeError = new Error('err');
            subscriber.on('error', err => {
                assert.strictEqual(err, fakeError);
                done();
            });
            stream.emit('error', fakeError);
        });
        (0, mocha_1.it)('should close the subscriber if stream closes unexpectedly', done => {
            const stub = sandbox.stub(subscriber, 'close');
            const stream = stubs.get('messageStream');
            stream.emit('close');
            process.nextTick(() => {
                assert.strictEqual(stub.callCount, 1);
                done();
            });
        });
        (0, mocha_1.it)('should add messages to the inventory', done => {
            subscriber.open();
            const modAckStub = sandbox.stub(subscriber, 'modAck');
            const stream = stubs.get('messageStream');
            const pullResponse = { receivedMessages: [RECEIVED_MESSAGE] };
            const inventory = stubs.get('inventory');
            const addStub = sandbox.stub(inventory, 'add').callsFake(() => {
                const [addMsg] = addStub.lastCall.args;
                assert.deepStrictEqual(addMsg, message);
                // test for receipt
                const [modAckMsg, deadline] = modAckStub.lastCall.args;
                assert.strictEqual(addMsg, modAckMsg);
                assert.strictEqual(deadline, subscriber.ackDeadline);
                done();
            });
            sandbox.stub(global.Date, 'now').returns(message.received);
            stream.emit('data', pullResponse);
        });
        (0, mocha_1.it)('should pause the stream when full', () => {
            const inventory = stubs.get('inventory');
            const stream = stubs.get('messageStream');
            const pauseStub = sandbox.stub(stream, 'pause');
            inventory.emit('full');
            assert.strictEqual(pauseStub.callCount, 1);
        });
        (0, mocha_1.it)('should resume the stream when not full', () => {
            const inventory = stubs.get('inventory');
            const stream = stubs.get('messageStream');
            const resumeStub = sandbox.stub(stream, 'resume');
            inventory.emit('free');
            assert.strictEqual(resumeStub.callCount, 1);
        });
        (0, mocha_1.it)('should set isOpen to false', () => {
            subscriber.open();
            assert.strictEqual(subscriber.isOpen, true);
        });
    });
    (0, mocha_1.describe)('setOptions', () => {
        (0, mocha_1.beforeEach)(() => subscriber.close());
        (0, mocha_1.it)('should capture the ackDeadline', () => {
            const ackDeadline = 1232;
            subscriber.setOptions({ ackDeadline });
            assert.strictEqual(subscriber.ackDeadline, ackDeadline);
        });
        (0, mocha_1.it)('should not set maxStreams higher than maxMessages', () => {
            const maxMessages = 3;
            const flowControl = { maxMessages };
            subscriber.setOptions({ flowControl });
            subscriber.open();
            const stream = stubs.get('messageStream');
            assert.strictEqual(stream.options.maxStreams, maxMessages);
        });
    });
    (0, mocha_1.describe)('OpenTelemetry tracing', () => {
        const enableTracing = {
            enableOpenTelemetryTracing: true,
        };
        const disableTracing = {
            enableOpenTelemetryTracing: false,
        };
        (0, mocha_1.beforeEach)(() => {
            tracing_1.exporter.reset();
        });
        (0, mocha_1.afterEach)(() => {
            tracing_1.exporter.reset();
            subscriber.close();
        });
        (0, mocha_1.it)('should not instantiate a tracer when tracing is disabled', () => {
            subscriber = new Subscriber(subscription, {});
            assert.strictEqual(subscriber['_useOpentelemetry'], false);
        });
        (0, mocha_1.it)('should instantiate a tracer when tracing is enabled through constructor', () => {
            subscriber = new Subscriber(subscription, enableTracing);
            assert.ok(subscriber['_useOpentelemetry']);
        });
        (0, mocha_1.it)('should instantiate a tracer when tracing is enabled through setOptions', () => {
            subscriber = new Subscriber(subscription, {});
            subscriber.setOptions(enableTracing);
            assert.ok(subscriber['_useOpentelemetry']);
        });
        (0, mocha_1.it)('should disable tracing when tracing is disabled through setOptions', () => {
            subscriber = new Subscriber(subscription, enableTracing);
            subscriber.setOptions(disableTracing);
            assert.strictEqual(subscriber['_useOpentelemetry'], false);
        });
        (0, mocha_1.it)('exports a span once it is created', () => {
            subscription = new FakeSubscription();
            subscriber = new Subscriber(subscription, enableTracing);
            message = new Message(subscriber, RECEIVED_MESSAGE);
            assert.strictEqual(subscriber['_useOpentelemetry'], true);
            subscriber.open();
            // Construct mock of received message with span context
            const parentSpanContext = {
                traceId: 'd4cda95b652f4a1592b449d5929fda1b',
                spanId: '6e0c63257de34c92',
                traceFlags: opentelemetry.TraceFlags.SAMPLED,
            };
            const messageWithSpanContext = {
                ackId: uuid.v4(),
                message: {
                    attributes: {
                        googclient_OpenTelemetrySpanContext: JSON.stringify(parentSpanContext),
                    },
                    data: Buffer.from('Hello, world!'),
                    messageId: uuid.v4(),
                    orderingKey: 'ordering-key',
                    publishTime: { seconds: 12, nanos: 32 },
                },
            };
            const pullResponse = {
                receivedMessages: [messageWithSpanContext],
            };
            // Receive message and assert that it was exported
            const msgStream = stubs.get('messageStream');
            msgStream.emit('data', pullResponse);
            const spans = tracing_1.exporter.getFinishedSpans();
            assert.strictEqual(spans.length, 1);
            const firstSpan = spans.concat().shift();
            assert.ok(firstSpan);
            assert.strictEqual(firstSpan.parentSpanId, parentSpanContext.spanId);
            assert.strictEqual(firstSpan.name, `${subscriber.name} process`, 'name of span should match');
            assert.strictEqual(firstSpan.kind, api_1.SpanKind.CONSUMER, 'span kind should be CONSUMER');
            assert.strictEqual(firstSpan.attributes[semantic_conventions_1.SemanticAttributes.MESSAGING_OPERATION], 'process', 'span messaging operation should match');
            assert.strictEqual(firstSpan.attributes[semantic_conventions_1.SemanticAttributes.MESSAGING_SYSTEM], 'pubsub');
            assert.strictEqual(firstSpan.attributes[semantic_conventions_1.SemanticAttributes.MESSAGING_MESSAGE_ID], messageWithSpanContext.message.messageId, 'span messaging id should match');
            assert.strictEqual(firstSpan.attributes[semantic_conventions_1.SemanticAttributes.MESSAGING_DESTINATION], subscriber.name, 'span messaging destination should match');
            assert.strictEqual(firstSpan.attributes[semantic_conventions_1.SemanticAttributes.MESSAGING_DESTINATION_KIND], 'topic');
        });
        (0, mocha_1.it)('does not export a span when a span context is not present on message', () => {
            subscriber = new Subscriber(subscription, enableTracing);
            const pullResponse = {
                receivedMessages: [RECEIVED_MESSAGE],
            };
            // Receive message and assert that it was exported
            const stream = stubs.get('messageStream');
            stream.emit('data', pullResponse);
            assert.strictEqual(tracing_1.exporter.getFinishedSpans().length, 0);
        });
    });
    (0, mocha_1.describe)('Message', () => {
        (0, mocha_1.describe)('initialization', () => {
            (0, mocha_1.it)('should localize ackId', () => {
                assert.strictEqual(message.ackId, RECEIVED_MESSAGE.ackId);
            });
            (0, mocha_1.it)('should localize attributes', () => {
                assert.strictEqual(message.attributes, RECEIVED_MESSAGE.message.attributes);
            });
            (0, mocha_1.it)('should localize data', () => {
                assert.strictEqual(message.data, RECEIVED_MESSAGE.message.data);
            });
            (0, mocha_1.it)('should localize id', () => {
                assert.strictEqual(message.id, RECEIVED_MESSAGE.message.messageId);
            });
            (0, mocha_1.it)('should localize orderingKey', () => {
                assert.strictEqual(message.orderingKey, RECEIVED_MESSAGE.message.orderingKey);
            });
            (0, mocha_1.it)('should localize publishTime', () => {
                const m = new Message(subscriber, RECEIVED_MESSAGE);
                const timestamp = m.publishTime;
                assert(timestamp instanceof FakePreciseDate);
                assert.strictEqual(timestamp.value, RECEIVED_MESSAGE.message.publishTime);
            });
            (0, mocha_1.it)('should localize received time', () => {
                const now = Date.now();
                sandbox.stub(global.Date, 'now').returns(now);
                const m = new Message(subscriber, RECEIVED_MESSAGE);
                assert.strictEqual(m.received, now);
            });
        });
        (0, mocha_1.describe)('deliveryAttempt', () => {
            (0, mocha_1.it)('should store the delivery attempt', () => {
                const deliveryAttempt = 10;
                const message = Object.assign({ deliveryAttempt }, RECEIVED_MESSAGE);
                const m = new Message(subscriber, message);
                const attempt = m.deliveryAttempt;
                assert.strictEqual(attempt, deliveryAttempt);
            });
            (0, mocha_1.it)('should default to 0', () => {
                const m = new Message(subscriber, RECEIVED_MESSAGE);
                const attempt = m.deliveryAttempt;
                assert.strictEqual(attempt, 0);
            });
        });
        (0, mocha_1.describe)('length', () => {
            (0, mocha_1.it)('should return the data length', () => {
                assert.strictEqual(message.length, message.data.length);
            });
            (0, mocha_1.it)('should preserve the original data lenght', () => {
                const originalLength = message.data.length;
                message.data = Buffer.from('ohno');
                assert.notStrictEqual(message.length, message.data.length);
                assert.strictEqual(message.length, originalLength);
            });
        });
        (0, mocha_1.describe)('ack', () => {
            (0, mocha_1.it)('should ack the message', () => {
                const stub = sandbox.stub(subscriber, 'ack');
                message.ack();
                const [msg] = stub.lastCall.args;
                assert.strictEqual(msg, message);
            });
            (0, mocha_1.it)('should not ack the message if its been handled', () => {
                const stub = sandbox.stub(subscriber, 'ack');
                message.nack();
                message.ack();
                assert.strictEqual(stub.callCount, 0);
            });
        });
        (0, mocha_1.describe)('modAck', () => {
            (0, mocha_1.it)('should modAck the message', () => {
                const fakeDeadline = 10;
                const stub = sandbox.stub(subscriber, 'modAck');
                message.modAck(fakeDeadline);
                const [msg, deadline] = stub.lastCall.args;
                assert.strictEqual(msg, message);
                assert.strictEqual(deadline, fakeDeadline);
            });
            (0, mocha_1.it)('should not modAck the message if its been handled', () => {
                const deadline = 10;
                const stub = sandbox.stub(subscriber, 'modAck');
                message.ack();
                message.modAck(deadline);
                assert.strictEqual(stub.callCount, 0);
            });
        });
        (0, mocha_1.describe)('nack', () => {
            (0, mocha_1.it)('should nack the message', () => {
                const stub = sandbox.stub(subscriber, 'modAck');
                message.nack();
                const [msg, delay] = stub.lastCall.args;
                assert.strictEqual(msg, message);
                assert.strictEqual(delay, 0);
            });
            (0, mocha_1.it)('should not nack the message if its been handled', () => {
                const stub = sandbox.stub(subscriber, 'modAck');
                message.ack();
                message.nack();
                assert.strictEqual(stub.callCount, 0);
            });
        });
    });
});
//# sourceMappingURL=subscriber.js.map