"use strict";
// Copyright 2014 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
const pjy = require("@google-cloud/projectify");
const arrify = require("arrify");
const assert = require("assert");
const mocha_1 = require("mocha");
const gax = require("google-gax");
const proxyquire = require("proxyquire");
const sinon = require("sinon");
const defer = require("p-defer");
const pubsubTypes = require("../src/pubsub");
const subby = require("../src/subscription");
const util = require("../src/util");
const src_1 = require("../src");
const schema_1 = require("../src/schema");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PKG = require('../../package.json');
const sandbox = sinon.createSandbox();
const fakeCreds = {};
sandbox.stub(gax.grpc.credentials, 'createInsecure').returns(fakeCreds);
const subscriptionCached = subby.Subscription;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let subscriptionOverride;
function Subscription(pubsub, name, options) {
    const overrideFn = subscriptionOverride || subscriptionCached;
    return new overrideFn(pubsub, name, options);
}
let promisified = false;
const fakeUtil = Object.assign({}, util, {
    promisifySome(class_, classProtos, methods) {
        if (class_.name === 'PubSub') {
            promisified = true;
            assert.deepStrictEqual(methods, [
                'close',
                'createSubscription',
                'createTopic',
                'detachSubscription',
                'getSnapshots',
                'getSubscriptions',
                'getTopics',
            ]);
        }
        // Defeats the method name type check.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        util.promisifySome(class_, classProtos, methods);
    },
});
let pjyOverride;
function fakePjy(...args) {
    return (pjyOverride || pjy.replaceProjectIdToken)(...args);
}
class FakeSnapshot {
    constructor(...args) {
        this.calledWith_ = args;
    }
}
class FakeTopic {
    constructor(...args) {
        this.calledWith_ = args;
    }
}
let extended = false;
const fakePaginator = {
    // tslint:disable-next-line variable-name
    extend(Class, methods) {
        if (Class.name !== 'PubSub') {
            return;
        }
        methods = arrify(methods);
        assert.strictEqual(Class.name, 'PubSub');
        assert.deepStrictEqual(methods, [
            'getSnapshots',
            'getSubscriptions',
            'getTopics',
        ]);
        extended = true;
    },
    streamify(methodName) {
        return methodName;
    },
};
let googleAuthOverride;
function fakeGoogleAuth(...args) {
    return (googleAuthOverride || util.noop)(...args);
}
const v1Override = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let v1ClientOverrides = {};
function defineOverridableClient(clientName) {
    class DefaultClient {
        fakeMethod() { }
    }
    DefaultClient.scopes = [];
    Object.defineProperty(v1Override, clientName, {
        get() {
            return v1ClientOverrides[clientName] || DefaultClient;
        },
    });
}
defineOverridableClient('FakeClient');
defineOverridableClient('PublisherClient');
defineOverridableClient('SubscriberClient');
(0, mocha_1.describe)('PubSub', () => {
    // tslint:disable-next-line variable-name
    let PubSub;
    const PROJECT_ID = 'test-project';
    let pubsub;
    const OPTIONS = {
        projectId: PROJECT_ID,
    };
    const PUBSUB_EMULATOR_HOST = process.env.PUBSUB_EMULATOR_HOST;
    (0, mocha_1.before)(() => {
        delete process.env.PUBSUB_EMULATOR_HOST;
        PubSub = proxyquire('../src/pubsub', {
            '@google-cloud/paginator': {
                paginator: fakePaginator,
            },
            '@google-cloud/projectify': {
                replaceProjectIdToken: fakePjy,
            },
            'google-auth-library': {
                GoogleAuth: fakeGoogleAuth,
            },
            grpc: gax.grpc,
            './snapshot': { Snapshot: FakeSnapshot },
            './subscription': { Subscription },
            './topic': { Topic: FakeTopic },
            './v1': v1Override,
            './util': fakeUtil,
        }).PubSub;
    });
    (0, mocha_1.after)(() => {
        if (PUBSUB_EMULATOR_HOST) {
            process.env.PUBSUB_EMULATOR_HOST = PUBSUB_EMULATOR_HOST;
        }
    });
    (0, mocha_1.beforeEach)(() => {
        v1ClientOverrides = {};
        googleAuthOverride = null;
        pubsub = new PubSub(OPTIONS);
        pubsub.projectId = PROJECT_ID;
    });
    (0, mocha_1.describe)('instantiation', () => {
        const maxMetadataSizeKey = 'grpc.max_metadata_size';
        const DEFAULT_OPTIONS = {
            libName: 'gccl',
            libVersion: PKG.version,
            scopes: [],
            [maxMetadataSizeKey]: 4 * 1024 * 1024,
        };
        (0, mocha_1.it)('should extend the correct methods', () => {
            assert(extended); // See `fakePaginator.extend`
        });
        (0, mocha_1.it)('should streamify the correct methods', () => {
            assert.strictEqual(pubsub.getSnapshotsStream, 'getSnapshots');
            assert.strictEqual(pubsub.getSubscriptionsStream, 'getSubscriptions');
            assert.strictEqual(pubsub.getTopicsStream, 'getTopics');
        });
        (0, mocha_1.it)('should promisify some of the things', () => {
            assert(promisified);
        });
        (0, mocha_1.it)('should return an instance', () => {
            assert(new PubSub() instanceof PubSub);
        });
        (0, mocha_1.it)('should augment the gRPC options for metadata size', () => {
            let pubsub = new PubSub();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let optionsAny = pubsub.options;
            assert.strictEqual(optionsAny[maxMetadataSizeKey], 4 * 1024 * 1024);
            optionsAny = {
                [maxMetadataSizeKey]: 1 * 1024 * 1024,
            };
            pubsub = new PubSub(optionsAny);
            optionsAny = pubsub.options;
            assert.strictEqual(optionsAny[maxMetadataSizeKey], 1 * 1024 * 1024);
        });
        (0, mocha_1.it)('should combine all required scopes', () => {
            v1ClientOverrides.SubscriberClient = {};
            v1ClientOverrides.SubscriberClient.scopes = ['a', 'b', 'c'];
            v1ClientOverrides.PublisherClient = {};
            v1ClientOverrides.PublisherClient.scopes = ['b', 'c', 'd', 'e'];
            const pubsub = new PubSub({});
            const options = { scopes: ['a', 'b', 'c', 'd', 'e'] };
            const expectedOptions = Object.assign({}, DEFAULT_OPTIONS, options);
            assert.deepStrictEqual(pubsub.options, expectedOptions);
        });
        (0, mocha_1.it)('should attempt to determine the service path and port', () => {
            const determineBaseUrl_ = PubSub.prototype.determineBaseUrl_;
            let called = false;
            PubSub.prototype.determineBaseUrl_ = () => {
                PubSub.prototype.determineBaseUrl_ = determineBaseUrl_;
                called = true;
            };
            // tslint:disable-next-line no-unused-expression
            new PubSub({});
            assert(called);
        });
        (0, mocha_1.it)('should initialize the API object', () => {
            assert.deepStrictEqual(pubsub.api, {});
        });
        (0, mocha_1.it)('should default to the opened state', () => {
            assert.strictEqual(pubsub.isOpen, true);
        });
        (0, mocha_1.it)('should not be in the opened state after close()', async () => {
            var _a;
            await ((_a = pubsub.close) === null || _a === void 0 ? void 0 : _a.call(pubsub));
            assert.strictEqual(pubsub.isOpen, false);
        });
        (0, mocha_1.it)('should cache a local google-auth-library instance', () => {
            const fakeGoogleAuthInstance = {};
            const options = {
                a: 'b',
                c: 'd',
            };
            const expectedOptions = Object.assign({}, DEFAULT_OPTIONS, options);
            googleAuthOverride = (options_) => {
                assert.deepStrictEqual(options_, expectedOptions);
                return fakeGoogleAuthInstance;
            };
            const pubsub = new PubSub(options);
            assert.strictEqual(pubsub.auth, fakeGoogleAuthInstance);
        });
        (0, mocha_1.it)('should localize the options provided', () => {
            const expectedOptions = Object.assign({}, DEFAULT_OPTIONS, OPTIONS);
            assert.deepStrictEqual(pubsub.options, expectedOptions);
        });
        (0, mocha_1.it)('should set the projectId', () => {
            assert.strictEqual(pubsub.projectId, PROJECT_ID);
        });
        (0, mocha_1.it)('should default the projectId to the token', () => {
            const pubsub = new PubSub({});
            assert.strictEqual(pubsub.projectId, '{{projectId}}');
        });
        (0, mocha_1.it)('should set isEmulator to false by default', () => {
            assert.strictEqual(pubsub.isEmulator, false);
        });
    });
    (0, mocha_1.describe)('createSubscription', () => {
        const TOPIC_NAME = 'topic';
        pubsub = new pubsubTypes.PubSub({});
        const TOPIC = Object.assign(new FakeTopic(), {
            name: 'projects/' + PROJECT_ID + '/topics/' + TOPIC_NAME,
        });
        const SUB_NAME = 'subscription';
        const SUBSCRIPTION = {
            name: 'projects/' + PROJECT_ID + '/subscriptions/' + SUB_NAME,
        };
        const apiResponse = {
            name: 'subscription-name',
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subClass = Subscription;
        (0, mocha_1.beforeEach)(() => {
            subClass.formatMetadata_ = (metadata) => {
                return Object.assign({}, metadata);
            };
        });
        (0, mocha_1.it)('should throw if no Topic is provided', async () => {
            await assert.rejects(async () => {
                var _a;
                await ((_a = pubsub.createSubscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, undefined, undefined));
            }, /A Topic is required for a new subscription\./);
        });
        (0, mocha_1.it)('should throw if no subscription name is provided', async () => {
            await assert.rejects(async () => {
                var _a;
                await ((_a = pubsub.createSubscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, TOPIC_NAME, undefined));
            }, /A subscription name is required./);
        });
        (0, mocha_1.it)('should not require configuration options', done => {
            var _a;
            pubsub.request = (config, callback) => {
                callback(null, apiResponse);
            };
            (_a = pubsub.createSubscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, TOPIC, SUB_NAME, done);
        });
        (0, mocha_1.it)('should allow undefined/optional configuration options', done => {
            pubsub.request = (config, callback) => {
                callback(null, apiResponse);
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pubsub.createSubscription(TOPIC, SUB_NAME, undefined, done);
        });
        (0, mocha_1.it)('should create a Subscription', done => {
            var _a;
            const opts = { a: 'b', c: 'd' };
            pubsub.request = util.noop;
            pubsub.subscription = (subName, options) => {
                assert.strictEqual(subName, SUB_NAME);
                assert.deepStrictEqual(options, opts);
                setImmediate(done);
                return SUBSCRIPTION;
            };
            (_a = pubsub.createSubscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, TOPIC, SUB_NAME, opts, assert.ifError);
        });
        (0, mocha_1.it)('should create a Topic object from a string', done => {
            var _a;
            pubsub.request = util.noop;
            pubsub.topic = topicName => {
                assert.strictEqual(topicName, TOPIC_NAME);
                setImmediate(done);
                return TOPIC;
            };
            (_a = pubsub.createSubscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, TOPIC_NAME, SUB_NAME, assert.ifError);
        });
        (0, mocha_1.it)('should send correct request', done => {
            var _a;
            const options = {
                gaxOpts: {},
            };
            pubsub.topic = topicName => {
                return {
                    name: topicName,
                };
            };
            pubsub.subscription = subName => {
                return {
                    name: subName,
                };
            };
            const reqOpts = { topic: TOPIC.name, name: SUB_NAME };
            pubsub.request = config => {
                assert.strictEqual(config.client, 'SubscriberClient');
                assert.strictEqual(config.method, 'createSubscription');
                assert.deepStrictEqual(config.reqOpts, reqOpts);
                assert.deepStrictEqual(config.gaxOpts, options.gaxOpts);
                done();
            };
            (_a = pubsub.createSubscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, TOPIC, SUB_NAME, options, assert.ifError);
        });
        (0, mocha_1.it)('should pass options to the api request', done => {
            var _a;
            const options = {
                retainAckedMessages: true,
                pushEndpoint: 'https://domain/push',
            };
            const expectedBody = Object.assign({ topic: TOPIC.name, name: SUB_NAME }, options);
            pubsub.topic = () => {
                return {
                    name: TOPIC_NAME,
                };
            };
            pubsub.subscription = () => {
                return {
                    name: SUB_NAME,
                };
            };
            pubsub.request = config => {
                assert.notStrictEqual(config.reqOpts, options);
                assert.deepStrictEqual(config.reqOpts, expectedBody);
                done();
            };
            (_a = pubsub.createSubscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, TOPIC, SUB_NAME, options, assert.ifError);
        });
        (0, mocha_1.it)('should discard flow control options', done => {
            var _a;
            const options = {
                flowControl: {},
            };
            const expectedBody = {
                topic: TOPIC.name,
                name: SUB_NAME,
            };
            pubsub.topic = () => {
                return {
                    name: TOPIC_NAME,
                };
            };
            pubsub.subscription = () => {
                return {
                    name: SUB_NAME,
                };
            };
            pubsub.request = config => {
                assert.notStrictEqual(config.reqOpts, options);
                assert.deepStrictEqual(config.reqOpts, expectedBody);
                done();
            };
            (_a = pubsub.createSubscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, TOPIC, SUB_NAME, options, assert.ifError);
        });
        (0, mocha_1.it)('should format the metadata', done => {
            var _a;
            const fakeMetadata = {};
            const formatted = {
                a: 'a',
            };
            subClass.formatMetadata_ = (metadata) => {
                assert.deepStrictEqual(metadata, fakeMetadata);
                return formatted;
            };
            pubsub.request = (config) => {
                assert.strictEqual(config.reqOpts, formatted);
                done();
            };
            (_a = pubsub.createSubscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, TOPIC, SUB_NAME, fakeMetadata, assert.ifError);
        });
        (0, mocha_1.describe)('error', () => {
            const error = new Error('Error.');
            const apiResponse = { name: SUB_NAME };
            (0, mocha_1.beforeEach)(() => {
                pubsub.request = (config, callback) => {
                    callback(error, apiResponse);
                };
            });
            (0, mocha_1.it)('should return error & API response to the callback', done => {
                var _a;
                pubsub.request = (config, callback) => {
                    callback(error, apiResponse);
                };
                function callback(err, sub, resp) {
                    assert.strictEqual(err, error);
                    assert.strictEqual(sub, null);
                    assert.strictEqual(resp, apiResponse);
                    done();
                }
                (_a = pubsub.createSubscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, TOPIC_NAME, SUB_NAME, callback);
            });
        });
        (0, mocha_1.describe)('success', () => {
            const apiResponse = { name: SUB_NAME };
            (0, mocha_1.beforeEach)(() => {
                pubsub.request = (config, callback) => {
                    callback(null, apiResponse);
                };
            });
            (0, mocha_1.it)('should return Subscription & resp to the callback', done => {
                var _a;
                const subscription = {};
                pubsub.subscription = () => {
                    return subscription;
                };
                pubsub.request = (config, callback) => {
                    callback(null, apiResponse);
                };
                function callback(err, sub, resp) {
                    assert.ifError(err);
                    assert.strictEqual(sub, subscription);
                    assert.strictEqual(resp, apiResponse);
                    done();
                }
                (_a = pubsub.createSubscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, TOPIC_NAME, SUB_NAME, callback);
            });
        });
    });
    (0, mocha_1.describe)('createTopic', () => {
        (0, mocha_1.it)('should make the correct API request', done => {
            const pubsub = new pubsubTypes.PubSub();
            const topicName = 'new-topic-name';
            const formattedName = 'formatted-name';
            const gaxOpts = {};
            pubsub.topic = name => {
                assert.strictEqual(name, topicName);
                return {
                    name: formattedName,
                };
            };
            pubsub.request = config => {
                assert.strictEqual(config.client, 'PublisherClient');
                assert.strictEqual(config.method, 'createTopic');
                assert.deepStrictEqual(config.reqOpts, { name: formattedName });
                assert.deepStrictEqual(config.gaxOpts, gaxOpts);
                done();
            };
            pubsub.createTopic(topicName, gaxOpts, () => { });
        });
        (0, mocha_1.describe)('error', () => {
            const error = new Error('Error.');
            const apiResponse = {};
            (0, mocha_1.beforeEach)(() => {
                pubsub.request = (config, callback) => {
                    callback(error, apiResponse);
                };
            });
            (0, mocha_1.it)('should return an error & API response', done => {
                var _a;
                (_a = pubsub.createTopic) === null || _a === void 0 ? void 0 : _a.call(pubsub, 'new-topic', (err, topic, apiResponse_) => {
                    assert.strictEqual(err, error);
                    assert.strictEqual(topic, null);
                    assert.strictEqual(apiResponse_, apiResponse);
                    done();
                });
            });
        });
        (0, mocha_1.describe)('success', () => {
            const apiResponse = {};
            (0, mocha_1.beforeEach)(() => {
                pubsub.request = (config, callback) => {
                    callback(null, apiResponse);
                };
            });
            (0, mocha_1.it)('should return a Topic object', done => {
                var _a;
                const topicName = 'new-topic';
                const topicInstance = {};
                pubsub.topic = name => {
                    assert.strictEqual(name, topicName);
                    return topicInstance;
                };
                (_a = pubsub.createTopic) === null || _a === void 0 ? void 0 : _a.call(pubsub, topicName, (err, topic) => {
                    assert.ifError(err);
                    assert.strictEqual(topic, topicInstance);
                    done();
                });
            });
            (0, mocha_1.it)('should pass apiResponse to callback', done => {
                var _a;
                (_a = pubsub.createTopic) === null || _a === void 0 ? void 0 : _a.call(pubsub, 'new-topic', (err, topic, apiResponse_) => {
                    assert.ifError(err);
                    assert.strictEqual(apiResponse_, apiResponse);
                    done();
                });
            });
        });
    });
    (0, mocha_1.describe)('detachSubscription', () => {
        pubsub = new pubsubTypes.PubSub({});
        const SUB_NAME = 'subscription';
        const SUBSCRIPTION = {
            name: 'projects/' + PROJECT_ID + '/subscriptions/' + SUB_NAME,
        };
        const apiResponse = 'responseToCheck';
        (0, mocha_1.it)('should throw if no subscription name is provided', async () => {
            await assert.rejects(async () => {
                var _a;
                await ((_a = pubsub.detachSubscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, undefined));
            }, /A subscription name is required./);
        });
        (0, mocha_1.it)('should not require configuration options', done => {
            var _a;
            sandbox
                .stub(pubsub, 'request')
                .callsArgOnWith(1, undefined, undefined, apiResponse);
            (_a = pubsub.detachSubscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, SUB_NAME, (err, response) => {
                assert.strictEqual(response, apiResponse);
                done();
            });
        });
        (0, mocha_1.it)('should allow undefined/optional configuration options', done => {
            var _a;
            sandbox
                .stub(pubsub, 'request')
                .callsArgOnWith(1, undefined, undefined, apiResponse);
            (_a = pubsub.detachSubscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, SUB_NAME, undefined, (_err, _response) => {
                assert.strictEqual(_response, apiResponse);
                done();
            });
        });
        (0, mocha_1.it)('should detach a Subscription from a string', async () => {
            var _a;
            sandbox.stub(pubsub, 'request').callsArg(1);
            sandbox.stub(pubsub, 'subscription').callsFake(subName => {
                assert.strictEqual(subName, SUB_NAME);
                return SUBSCRIPTION;
            });
            await ((_a = pubsub.detachSubscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, SUB_NAME));
        });
        (0, mocha_1.it)('should send correct request', done => {
            var _a;
            const options = {};
            sandbox.stub(pubsub, 'subscription').callsFake(subName => {
                assert.strictEqual(subName, SUB_NAME);
                return SUBSCRIPTION;
            });
            const reqOpts = { subscription: SUBSCRIPTION.name };
            sandbox.stub(pubsub, 'request').callsFake(config => {
                assert.strictEqual(config.client, 'PublisherClient');
                assert.strictEqual(config.method, 'detachSubscription');
                assert.deepStrictEqual(config.reqOpts, reqOpts);
                assert.deepStrictEqual(config.gaxOpts, options);
                done();
            });
            (_a = pubsub.detachSubscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, SUB_NAME, options, assert.ifError);
        });
        (0, mocha_1.it)('should pass options to the api request', done => {
            var _a;
            const options = {
                pageSize: 5,
                maxResults: 10,
            };
            sandbox.stub(pubsub, 'subscription').returns({
                name: SUB_NAME,
            });
            sandbox.stub(pubsub, 'request').callsFake(config => {
                assert.notStrictEqual(config.reqOpts, options);
                assert.deepStrictEqual(config.gaxOpts, options);
                done();
            });
            (_a = pubsub.detachSubscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, SUB_NAME, options, assert.ifError);
        });
    });
    (0, mocha_1.describe)('determineBaseUrl_', () => {
        function setHost(host) {
            process.env.PUBSUB_EMULATOR_HOST = host;
        }
        function setSdkUrl(url) {
            process.env.CLOUDSDK_API_ENDPOINT_OVERRIDES_PUBSUB = url;
        }
        function unsetVariables() {
            delete process.env.PUBSUB_EMULATOR_HOST;
            delete process.env.CLOUDSDK_API_ENDPOINT_OVERRIDES_PUBSUB;
        }
        (0, mocha_1.beforeEach)(() => {
            unsetVariables();
        });
        (0, mocha_1.it)('should do nothing if correct options are not set', () => {
            var _a, _b, _c;
            (_a = pubsub.determineBaseUrl_) === null || _a === void 0 ? void 0 : _a.call(pubsub);
            assert.strictEqual((_b = pubsub.options) === null || _b === void 0 ? void 0 : _b.servicePath, undefined);
            assert.strictEqual((_c = pubsub.options) === null || _c === void 0 ? void 0 : _c.port, undefined);
        });
        (0, mocha_1.it)('should use the apiEndpoint option', () => {
            var _a, _b;
            const defaultBaseUrl_ = 'defaulturl';
            const testingUrl = 'localhost:8085';
            setHost(defaultBaseUrl_);
            pubsub.options.apiEndpoint = testingUrl;
            (_a = pubsub.determineBaseUrl_) === null || _a === void 0 ? void 0 : _a.call(pubsub);
            assert.strictEqual((_b = pubsub.options) === null || _b === void 0 ? void 0 : _b.servicePath, 'localhost');
            assert.strictEqual(pubsub.options.port, 8085);
            assert.strictEqual(pubsub.options.sslCreds, fakeCreds);
            assert.strictEqual(pubsub.isEmulator, true);
        });
        (0, mocha_1.it)('should remove slashes from the baseUrl', () => {
            var _a, _b, _c;
            setHost('localhost:8080/');
            (_a = pubsub.determineBaseUrl_) === null || _a === void 0 ? void 0 : _a.call(pubsub);
            assert.strictEqual((_b = pubsub.options) === null || _b === void 0 ? void 0 : _b.servicePath, 'localhost');
            assert.strictEqual(pubsub.options.port, 8080);
            setHost('localhost:8081//');
            (_c = pubsub.determineBaseUrl_) === null || _c === void 0 ? void 0 : _c.call(pubsub);
            assert.strictEqual(pubsub.options.servicePath, 'localhost');
            assert.strictEqual(pubsub.options.port, 8081);
        });
        (0, mocha_1.it)('should set the port to undefined if not set', () => {
            var _a, _b;
            setHost('localhost');
            (_a = pubsub.determineBaseUrl_) === null || _a === void 0 ? void 0 : _a.call(pubsub);
            assert.strictEqual((_b = pubsub.options) === null || _b === void 0 ? void 0 : _b.servicePath, 'localhost');
            assert.strictEqual(pubsub.options.port, undefined);
        });
        (0, mocha_1.it)('should set the port to 80 for http with no port specified', () => {
            var _a, _b, _c;
            setHost('http://localhost/');
            (_a = pubsub.determineBaseUrl_) === null || _a === void 0 ? void 0 : _a.call(pubsub);
            assert.strictEqual((_b = pubsub.options) === null || _b === void 0 ? void 0 : _b.servicePath, 'localhost');
            assert.strictEqual((_c = pubsub.options) === null || _c === void 0 ? void 0 : _c.port, 80);
        });
        (0, mocha_1.it)('should set the port to 443 for https with no port specified', () => {
            var _a, _b;
            setHost('https://localhost/');
            (_a = pubsub.determineBaseUrl_) === null || _a === void 0 ? void 0 : _a.call(pubsub);
            assert.strictEqual((_b = pubsub.options) === null || _b === void 0 ? void 0 : _b.servicePath, 'localhost');
            assert.strictEqual(pubsub.options.port, 443);
        });
        (0, mocha_1.it)('should create credentials from local grpc if present', () => {
            var _a, _b;
            const fakeCredentials = {};
            const fakeGrpc = {
                credentials: {
                    createInsecure: () => fakeCredentials,
                },
            };
            setHost('localhost');
            pubsub.options.grpc = fakeGrpc;
            (_a = pubsub.determineBaseUrl_) === null || _a === void 0 ? void 0 : _a.call(pubsub);
            assert.strictEqual((_b = pubsub.options) === null || _b === void 0 ? void 0 : _b.sslCreds, fakeCredentials);
        });
        // This tests both the EMULATOR environment variable and detecting
        // an emulator URL.
        (0, mocha_1.describe)('with PUBSUB_EMULATOR_HOST environment variable', () => {
            const PUBSUB_EMULATOR_HOST = 'localhost:9090';
            (0, mocha_1.beforeEach)(() => {
                setHost(PUBSUB_EMULATOR_HOST);
            });
            (0, mocha_1.after)(() => {
                unsetVariables();
            });
            (0, mocha_1.it)('should use the PUBSUB_EMULATOR_HOST env var', () => {
                var _a, _b;
                (_a = pubsub.determineBaseUrl_) === null || _a === void 0 ? void 0 : _a.call(pubsub);
                assert.strictEqual((_b = pubsub.options) === null || _b === void 0 ? void 0 : _b.servicePath, 'localhost');
                assert.strictEqual(pubsub.options.port, 9090);
                assert.strictEqual(pubsub.isEmulator, true);
            });
        });
        // This tests both the CLOUDSDK environment variable and detecting
        // a non-emulator URL.
        (0, mocha_1.describe)('with CLOUDSDK_API_ENDPOINT_OVERRIDES_PUBSUB environment variable', () => {
            const server = 'some.test.server.googleapis.com';
            const apiUrl = `https://${server}/`;
            (0, mocha_1.beforeEach)(() => {
                setSdkUrl(apiUrl);
            });
            (0, mocha_1.after)(() => {
                unsetVariables();
            });
            (0, mocha_1.it)('should use the CLOUDSDK_API_ENDPOINT_OVERRIDES_PUBSUB env var', () => {
                var _a, _b, _c;
                (_a = pubsub.determineBaseUrl_) === null || _a === void 0 ? void 0 : _a.call(pubsub);
                assert.strictEqual((_b = pubsub.options) === null || _b === void 0 ? void 0 : _b.servicePath, server);
                assert.strictEqual((_c = pubsub.options) === null || _c === void 0 ? void 0 : _c.port, 443);
                assert.strictEqual(pubsub.isEmulator, false);
                assert.strictEqual(pubsub.options.sslCreds, undefined);
            });
        });
    });
    (0, mocha_1.describe)('getSnapshots', () => {
        const SNAPSHOT_NAME = 'fake-snapshot';
        const apiResponse = { snapshots: [{ name: SNAPSHOT_NAME }] };
        (0, mocha_1.beforeEach)(() => {
            pubsub.request = (config, callback) => {
                callback(null, apiResponse.snapshots, {}, apiResponse);
            };
        });
        (0, mocha_1.it)('should accept a query and a callback', done => {
            var _a;
            (_a = pubsub.getSnapshots) === null || _a === void 0 ? void 0 : _a.call(pubsub, {}, done);
        });
        (0, mocha_1.it)('should accept just a callback', done => {
            var _a;
            (_a = pubsub.getSnapshots) === null || _a === void 0 ? void 0 : _a.call(pubsub, done);
        });
        (0, mocha_1.it)('should build the right request', done => {
            var _a;
            const options = {
                a: 'b',
                c: 'd',
                gaxOpts: {
                    e: 'f',
                },
                autoPaginate: false,
            };
            const expectedOptions = Object.assign({}, options, {
                project: 'projects/' + pubsub.projectId,
            });
            const expectedGaxOpts = Object.assign({
                autoPaginate: options.autoPaginate,
            }, options.gaxOpts);
            delete expectedOptions.gaxOpts;
            delete expectedOptions.autoPaginate;
            pubsub.request = config => {
                assert.strictEqual(config.client, 'SubscriberClient');
                assert.strictEqual(config.method, 'listSnapshots');
                assert.deepStrictEqual(config.reqOpts, expectedOptions);
                assert.deepStrictEqual(config.gaxOpts, expectedGaxOpts);
                done();
            };
            (_a = pubsub.getSnapshots) === null || _a === void 0 ? void 0 : _a.call(pubsub, options, assert.ifError);
        });
        (0, mocha_1.it)('should return Snapshot instances with metadata', done => {
            var _a;
            const snapshot = {};
            sandbox.stub(pubsub, 'snapshot').callsFake(name => {
                assert.strictEqual(name, SNAPSHOT_NAME);
                return snapshot;
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (_a = pubsub.getSnapshots) === null || _a === void 0 ? void 0 : _a.call(pubsub, (err, snapshots) => {
                assert.ifError(err);
                assert.strictEqual(snapshots[0], snapshot);
                assert.strictEqual(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                snapshots[0].metadata, apiResponse.snapshots[0]);
                done();
            });
        });
        (0, mocha_1.it)('should pass back all parameters', done => {
            var _a;
            const err_ = new Error('abc');
            const snapshots_ = undefined;
            const nextQuery_ = {};
            const apiResponse_ = {};
            pubsub.request = (config, callback) => {
                callback(err_, snapshots_, nextQuery_, apiResponse_);
            };
            (_a = pubsub.getSnapshots) === null || _a === void 0 ? void 0 : _a.call(pubsub, (err, snapshots, apiResponse) => {
                assert.strictEqual(err, err_);
                assert.deepStrictEqual(snapshots, snapshots_);
                assert.strictEqual(apiResponse, nextQuery_);
                done();
            });
        });
    });
    (0, mocha_1.describe)('getSubscriptions', () => {
        const apiResponse = { subscriptions: [{ name: 'fake-subscription' }] };
        (0, mocha_1.beforeEach)(() => {
            pubsub.request = (config, callback) => {
                callback(null, apiResponse.subscriptions, {}, apiResponse);
            };
        });
        (0, mocha_1.it)('should accept a query and a callback', done => {
            var _a;
            (_a = pubsub.getSubscriptions) === null || _a === void 0 ? void 0 : _a.call(pubsub, {}, done);
        });
        (0, mocha_1.it)('should accept just a callback', done => {
            var _a;
            (_a = pubsub.getSubscriptions) === null || _a === void 0 ? void 0 : _a.call(pubsub, done);
        });
        (0, mocha_1.it)('should pass the correct arguments to the API', done => {
            var _a;
            const options = {
                gaxOpts: {
                    a: 'b',
                },
                autoPaginate: false,
            };
            const expectedGaxOpts = Object.assign({
                autoPaginate: options.autoPaginate,
            }, options.gaxOpts);
            const project = 'projects/' + pubsub.projectId;
            pubsub.request = config => {
                assert.strictEqual(config.client, 'SubscriberClient');
                assert.strictEqual(config.method, 'listSubscriptions');
                assert.deepStrictEqual(config.reqOpts, { project });
                assert.deepStrictEqual(config.gaxOpts, expectedGaxOpts);
                done();
            };
            (_a = pubsub.getSubscriptions) === null || _a === void 0 ? void 0 : _a.call(pubsub, options, assert.ifError);
        });
        (0, mocha_1.it)('should pass options to API request', done => {
            var _a;
            const opts = { pageSize: 10, pageToken: 'abc' };
            pubsub.request = config => {
                const reqOpts = config.reqOpts;
                const expectedOptions = Object.assign({}, opts, {
                    project: 'projects/' + pubsub.projectId,
                });
                assert.deepStrictEqual(reqOpts, expectedOptions);
                done();
            };
            (_a = pubsub.getSubscriptions) === null || _a === void 0 ? void 0 : _a.call(pubsub, opts, assert.ifError);
        });
        (0, mocha_1.it)('should return Subscription instances', done => {
            var _a;
            (_a = pubsub.getSubscriptions) === null || _a === void 0 ? void 0 : _a.call(pubsub, (err, subscriptions) => {
                assert.ifError(err);
                assert(subscriptions[0] instanceof subscriptionCached);
                done();
            });
        });
        (0, mocha_1.it)('should pass back all params', done => {
            var _a;
            const err_ = new Error('err');
            const subs_ = undefined;
            const nextQuery_ = {};
            const apiResponse_ = {};
            pubsub.request = (config, callback) => {
                callback(err_, subs_, nextQuery_, apiResponse_);
            };
            (_a = pubsub.getSubscriptions) === null || _a === void 0 ? void 0 : _a.call(pubsub, (err, subs, apiResponse) => {
                assert.strictEqual(err, err_);
                assert.deepStrictEqual(subs, subs_);
                assert.strictEqual(apiResponse, nextQuery_);
                done();
            });
        });
        (0, mocha_1.describe)('with topic', () => {
            const TOPIC_NAME = 'topic-name';
            (0, mocha_1.it)('should call topic.getSubscriptions', done => {
                var _a;
                const topic = new FakeTopic();
                const opts = {
                    topic,
                };
                topic.getSubscriptions = (options) => {
                    assert.strictEqual(options, opts);
                    done();
                };
                (_a = pubsub.getSubscriptions) === null || _a === void 0 ? void 0 : _a.call(pubsub, opts, assert.ifError);
            });
            (0, mocha_1.it)('should create a topic instance from a name', done => {
                var _a;
                const opts = {
                    topic: TOPIC_NAME,
                };
                const fakeTopic = {
                    getSubscriptions(options) {
                        assert.strictEqual(options, opts);
                        done();
                    },
                };
                pubsub.topic = (name) => {
                    assert.strictEqual(name, TOPIC_NAME);
                    return fakeTopic;
                };
                (_a = pubsub.getSubscriptions) === null || _a === void 0 ? void 0 : _a.call(pubsub, opts, assert.ifError);
            });
        });
    });
    (0, mocha_1.describe)('getTopics', () => {
        const topicName = 'fake-topic';
        const apiResponse = { topics: [{ name: topicName }] };
        (0, mocha_1.beforeEach)(() => {
            pubsub.request = (config, callback) => {
                callback(null, apiResponse.topics, {}, apiResponse);
            };
        });
        (0, mocha_1.it)('should accept a query and a callback', done => {
            var _a;
            (_a = pubsub.getTopics) === null || _a === void 0 ? void 0 : _a.call(pubsub, {}, done);
        });
        (0, mocha_1.it)('should accept just a callback', done => {
            var _a;
            (_a = pubsub.getTopics) === null || _a === void 0 ? void 0 : _a.call(pubsub, done);
        });
        (0, mocha_1.it)('should build the right request', done => {
            var _a;
            const options = {
                a: 'b',
                c: 'd',
                gaxOpts: {
                    e: 'f',
                },
                autoPaginate: false,
            };
            const expectedOptions = Object.assign({}, options, {
                project: 'projects/' + pubsub.projectId,
            });
            const expectedGaxOpts = Object.assign({
                autoPaginate: options.autoPaginate,
            }, options.gaxOpts);
            delete expectedOptions.gaxOpts;
            delete expectedOptions.autoPaginate;
            pubsub.request = config => {
                assert.strictEqual(config.client, 'PublisherClient');
                assert.strictEqual(config.method, 'listTopics');
                assert.deepStrictEqual(config.reqOpts, expectedOptions);
                assert.deepStrictEqual(config.gaxOpts, expectedGaxOpts);
                done();
            };
            (_a = pubsub.getTopics) === null || _a === void 0 ? void 0 : _a.call(pubsub, options, assert.ifError);
        });
        (0, mocha_1.it)('should return Topic instances with metadata', done => {
            var _a;
            const topic = {};
            pubsub.topic = name => {
                assert.strictEqual(name, topicName);
                return topic;
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (_a = pubsub.getTopics) === null || _a === void 0 ? void 0 : _a.call(pubsub, (err, topics) => {
                assert.ifError(err);
                assert.strictEqual(topics[0], topic);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                assert.strictEqual(topics[0].metadata, apiResponse.topics[0]);
                done();
            });
        });
        (0, mocha_1.it)('should pass back all params', done => {
            var _a;
            const err_ = new Error('err');
            const topics_ = undefined;
            const nextQuery_ = {};
            const apiResponse_ = {};
            pubsub.request = (config, callback) => {
                callback(err_, topics_, nextQuery_, apiResponse_);
            };
            (_a = pubsub.getTopics) === null || _a === void 0 ? void 0 : _a.call(pubsub, (err, topics, apiResponse) => {
                assert.strictEqual(err, err_);
                assert.deepStrictEqual(topics, topics_);
                assert.strictEqual(apiResponse, nextQuery_);
                done();
            });
        });
    });
    (0, mocha_1.describe)('request', () => {
        const CONFIG = {
            client: 'PublisherClient',
            method: 'fakeMethod',
            reqOpts: { a: 'a' },
            gaxOpts: { b: 'b' },
        };
        (0, mocha_1.beforeEach)(() => {
            delete pubsub.projectId;
            (0, mocha_1.afterEach)(() => sandbox.restore());
            sandbox.stub(pubsub, 'auth').value({
                getProjectId: () => Promise.resolve(PROJECT_ID),
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pjyOverride = (reqOpts) => {
                return reqOpts;
            };
        });
        (0, mocha_1.it)('should throw if the PubSub is already closed', done => {
            var _a;
            (_a = pubsub.close) === null || _a === void 0 ? void 0 : _a.call(pubsub, (err) => {
                var _a;
                assert.strictEqual(err, null);
                (_a = pubsub.request) === null || _a === void 0 ? void 0 : _a.call(pubsub, CONFIG, (errInner) => {
                    assert.notStrictEqual(errInner, null);
                    assert.strictEqual(errInner.message.indexOf('closed PubSub object') >= 0, true);
                    done();
                });
            });
        });
        (0, mocha_1.it)('should call getClient_ with the correct config', done => {
            var _a;
            pubsub.getClient_ = config => {
                assert.strictEqual(config, CONFIG);
                done();
            };
            (_a = pubsub.request) === null || _a === void 0 ? void 0 : _a.call(pubsub, CONFIG, assert.ifError);
        });
        (0, mocha_1.it)('should return error from getClient_', done => {
            var _a;
            const expectedError = new Error('some error');
            pubsub.getClient_ = (config, callback) => {
                callback(expectedError);
            };
            (_a = pubsub.request) === null || _a === void 0 ? void 0 : _a.call(pubsub, CONFIG, (err) => {
                assert.strictEqual(expectedError, err);
                done();
            });
        });
        (0, mocha_1.it)('should call client method with correct options', done => {
            var _a;
            const fakeClient = {};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fakeClient.fakeMethod = (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            reqOpts, gaxOpts) => {
                assert.deepStrictEqual(CONFIG.reqOpts, reqOpts);
                assert.deepStrictEqual(CONFIG.gaxOpts, gaxOpts);
                done();
            };
            pubsub.getClient_ = (config, callback) => {
                callback(null, fakeClient);
            };
            (_a = pubsub.request) === null || _a === void 0 ? void 0 : _a.call(pubsub, CONFIG, assert.ifError);
        });
        (0, mocha_1.it)('should replace the project id token on reqOpts', done => {
            var _a;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pjyOverride = (reqOpts, projectId) => {
                assert.deepStrictEqual(reqOpts, CONFIG.reqOpts);
                assert.strictEqual(projectId, PROJECT_ID);
                done();
            };
            (_a = pubsub.request) === null || _a === void 0 ? void 0 : _a.call(pubsub, CONFIG, assert.ifError);
        });
    });
    (0, mocha_1.describe)('getClientAsync_', () => {
        const FAKE_CLIENT_INSTANCE = class {
            close() { }
        };
        const CONFIG = {
            client: 'FakeClient',
        };
        (0, mocha_1.beforeEach)(() => {
            sandbox.stub(pubsub, 'auth').value({ getProjectId: () => util.noop });
            v1ClientOverrides.FakeClient = FAKE_CLIENT_INSTANCE;
        });
        (0, mocha_1.afterEach)(() => sandbox.restore());
        (0, mocha_1.describe)('closeAllClients_', () => {
            (0, mocha_1.it)('should close out any open client', async () => {
                var _a;
                // Create a client that we'll close.
                const client = await pubsub.getClientAsync_(CONFIG);
                // Stub out its close method, and verify it gets called.
                const stub = sandbox.stub(client, 'close').resolves();
                await ((_a = pubsub.closeAllClients_) === null || _a === void 0 ? void 0 : _a.call(pubsub));
                assert.strictEqual(stub.called, true);
            });
        });
        (0, mocha_1.describe)('project ID', () => {
            (0, mocha_1.beforeEach)(() => {
                delete pubsub.projectId;
                pubsub.isEmulator = false;
            });
            (0, mocha_1.it)('should get and cache the project ID', async () => {
                var _a, _b;
                sandbox.stub(pubsub.auth, 'getProjectId').resolves(PROJECT_ID);
                await ((_a = pubsub.getClientAsync_) === null || _a === void 0 ? void 0 : _a.call(pubsub, CONFIG));
                assert.strictEqual(pubsub.projectId, PROJECT_ID);
                assert.strictEqual((_b = pubsub.options) === null || _b === void 0 ? void 0 : _b.projectId, PROJECT_ID);
            });
            (0, mocha_1.it)('should get the project ID if placeholder', async () => {
                var _a;
                pubsub.projectId = '{{projectId}}';
                sandbox.stub(pubsub.auth, 'getProjectId').resolves(PROJECT_ID);
                await ((_a = pubsub.getClientAsync_) === null || _a === void 0 ? void 0 : _a.call(pubsub, CONFIG));
                assert.strictEqual(pubsub.projectId, PROJECT_ID);
            });
            (0, mocha_1.it)('should return auth errors that occur', async () => {
                var _a;
                const error = new Error('err');
                sandbox.stub(pubsub.auth, 'getProjectId').rejects(error);
                try {
                    await ((_a = pubsub.getClientAsync_) === null || _a === void 0 ? void 0 : _a.call(pubsub, CONFIG));
                    throw new Error('getClientAsync_ should have thrown an error');
                }
                catch (e) {
                    assert.strictEqual(e, error);
                }
            });
            (0, mocha_1.it)('should ignore auth errors when using the emulator', async () => {
                var _a;
                pubsub.isEmulator = true;
                const error = new Error('err');
                sandbox.stub(pubsub.auth, 'getProjectId').rejects(error);
                await ((_a = pubsub.getClientAsync_) === null || _a === void 0 ? void 0 : _a.call(pubsub, CONFIG));
                assert.strictEqual(pubsub.projectId, '');
            });
            (0, mocha_1.it)('should not get the project ID if already known', async () => {
                var _a;
                pubsub.projectId = PROJECT_ID;
                const error = new Error('getProjectId should not be called.');
                sandbox.stub(pubsub.auth, 'getProjectId').rejects(error);
                await ((_a = pubsub.getClientAsync_) === null || _a === void 0 ? void 0 : _a.call(pubsub, CONFIG));
            });
        });
        (0, mocha_1.it)('should cache the client', async () => {
            var _a, _b, _c, _d;
            (_a = pubsub.api) === null || _a === void 0 ? true : delete _a.fakeClient;
            let numTimesFakeClientInstantiated = 0;
            // tslint:disable-next-line only-arrow-functions
            v1ClientOverrides.FakeClient = function () {
                numTimesFakeClientInstantiated++;
                return FAKE_CLIENT_INSTANCE;
            };
            await ((_b = pubsub.getClientAsync_) === null || _b === void 0 ? void 0 : _b.call(pubsub, CONFIG));
            assert.strictEqual((_c = pubsub.api) === null || _c === void 0 ? void 0 : _c.FakeClient, FAKE_CLIENT_INSTANCE);
            await ((_d = pubsub.getClientAsync_) === null || _d === void 0 ? void 0 : _d.call(pubsub, CONFIG));
            assert.strictEqual(numTimesFakeClientInstantiated, 1);
        });
        (0, mocha_1.it)('should return the correct client', async () => {
            var _a;
            // tslint:disable-next-line only-arrow-functions no-any
            v1ClientOverrides.FakeClient = function (options) {
                assert.strictEqual(options, pubsub.options);
                return FAKE_CLIENT_INSTANCE;
            };
            const client = await ((_a = pubsub.getClientAsync_) === null || _a === void 0 ? void 0 : _a.call(pubsub, CONFIG));
            assert.strictEqual(client, FAKE_CLIENT_INSTANCE);
        });
    });
    (0, mocha_1.describe)('getClient_', () => {
        const FAKE_CLIENT_INSTANCE = {};
        const CONFIG = {
            client: 'FakeClient',
        };
        (0, mocha_1.it)('should get the client', done => {
            var _a;
            sandbox
                .stub(pubsub, 'getClientAsync_')
                .withArgs(CONFIG)
                .resolves(FAKE_CLIENT_INSTANCE);
            (_a = pubsub.getClient_) === null || _a === void 0 ? void 0 : _a.call(pubsub, CONFIG, (err, client) => {
                assert.ifError(err);
                assert.strictEqual(client, FAKE_CLIENT_INSTANCE);
                done();
            });
        });
        (0, mocha_1.it)('should pass back any errors', done => {
            var _a;
            const error = new Error('err');
            sandbox.stub(pubsub, 'getClientAsync_').rejects(error);
            (_a = pubsub.getClient_) === null || _a === void 0 ? void 0 : _a.call(pubsub, CONFIG, err => {
                assert.strictEqual(err, error);
                done();
            });
        });
    });
    (0, mocha_1.describe)('request', () => {
        const CONFIG = {
            client: 'SubscriberClient',
            method: 'fakeMethod',
            reqOpts: { a: 'a' },
            gaxOpts: {},
        };
        const FAKE_CLIENT_INSTANCE = {
            [CONFIG.method]: util.noop,
        };
        (0, mocha_1.beforeEach)(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pjyOverride = (reqOpts) => {
                return reqOpts;
            };
            pubsub.getClient_ = (config, callback) => {
                callback(null, FAKE_CLIENT_INSTANCE);
            };
        });
        (0, mocha_1.afterEach)(() => sandbox.restore());
        (0, mocha_1.it)('should get the client', done => {
            var _a;
            pubsub.getClient_ = config => {
                assert.strictEqual(config, CONFIG);
                done();
            };
            (_a = pubsub.request) === null || _a === void 0 ? void 0 : _a.call(pubsub, CONFIG, assert.ifError);
        });
        (0, mocha_1.it)('should return error from getting the client', done => {
            var _a;
            const error = new Error('Error.');
            pubsub.getClient_ = (config, callback) => {
                callback(error);
            };
            (_a = pubsub.request) === null || _a === void 0 ? void 0 : _a.call(pubsub, CONFIG, (err) => {
                assert.strictEqual(err, error);
                done();
            });
        });
        (0, mocha_1.it)('should replace the project id token on reqOpts', done => {
            var _a;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pjyOverride = (reqOpts, projectId) => {
                assert.deepStrictEqual(reqOpts, CONFIG.reqOpts);
                assert.strictEqual(projectId, PROJECT_ID);
                done();
            };
            (_a = pubsub.request) === null || _a === void 0 ? void 0 : _a.call(pubsub, CONFIG, assert.ifError);
        });
        (0, mocha_1.it)('should call the client method correctly', done => {
            var _a;
            const CONFIG = {
                client: 'FakeClient',
                method: 'fakeMethod',
                reqOpts: { a: 'a' },
                gaxOpts: {},
            };
            const replacedReqOpts = {};
            pjyOverride = () => {
                return replacedReqOpts;
            };
            const fakeClient = {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                fakeMethod(reqOpts, gaxOpts) {
                    assert.strictEqual(reqOpts, replacedReqOpts);
                    assert.strictEqual(gaxOpts, CONFIG.gaxOpts);
                    done();
                },
            };
            pubsub.getClient_ = (config, callback) => {
                callback(null, fakeClient);
            };
            (_a = pubsub.request) === null || _a === void 0 ? void 0 : _a.call(pubsub, CONFIG, assert.ifError);
        });
    });
    (0, mocha_1.describe)('snapshot', () => {
        (0, mocha_1.it)('should throw if a name is not provided', () => {
            assert.throws(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                pubsub.snapshot();
            }, /You must supply a valid name for the snapshot\./);
        });
        (0, mocha_1.it)('should return a Snapshot object', () => {
            var _a;
            const SNAPSHOT_NAME = 'new-snapshot';
            const snapshot = (_a = pubsub.snapshot) === null || _a === void 0 ? void 0 : _a.call(pubsub, SNAPSHOT_NAME);
            const args = snapshot.calledWith_;
            assert(snapshot instanceof FakeSnapshot);
            assert.strictEqual(args[0], pubsub);
            assert.strictEqual(args[1], SNAPSHOT_NAME);
        });
    });
    (0, mocha_1.describe)('subscription', () => {
        const SUB_NAME = 'new-sub-name';
        const CONFIG = {};
        (0, mocha_1.it)('should return a Subscription object', () => {
            var _a;
            // tslint:disable-next-line only-arrow-functions
            subscriptionOverride = function () { };
            const subscription = (_a = pubsub.subscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, SUB_NAME, {});
            assert(subscription instanceof subscriptionOverride);
        });
        (0, mocha_1.it)('should pass specified name to the Subscription', done => {
            var _a;
            // tslint:disable-next-line only-arrow-functions
            subscriptionOverride = function (pubsub, name) {
                assert.strictEqual(name, SUB_NAME);
                done();
            };
            (_a = pubsub.subscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, SUB_NAME);
        });
        (0, mocha_1.it)('should honor settings', done => {
            var _a;
            // tslint:disable-next-line only-arrow-functions
            subscriptionOverride = function (pubsub, name, options) {
                assert.strictEqual(options, CONFIG);
                done();
            };
            (_a = pubsub.subscription) === null || _a === void 0 ? void 0 : _a.call(pubsub, SUB_NAME, CONFIG);
        });
        (0, mocha_1.it)('should throw if a name is not provided', () => {
            assert.throws(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return pubsub.subscription();
            }, /A name must be specified for a subscription\./);
        });
    });
    (0, mocha_1.describe)('topic', () => {
        (0, mocha_1.it)('should throw if a name is not provided', () => {
            assert.throws(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                pubsub.topic();
            }, /A name must be specified for a topic\./);
        });
        (0, mocha_1.it)('should return a Topic object', () => {
            var _a;
            assert(((_a = pubsub.topic) === null || _a === void 0 ? void 0 : _a.call(pubsub, 'new-topic')) instanceof FakeTopic);
        });
        (0, mocha_1.it)('should pass the correct args', () => {
            var _a;
            const fakeName = 'with-options';
            const fakeOptions = {};
            const topic = (_a = pubsub.topic) === null || _a === void 0 ? void 0 : _a.call(pubsub, fakeName, fakeOptions);
            const [ps, name, options] = topic.calledWith_;
            assert.strictEqual(ps, pubsub);
            assert.strictEqual(name, fakeName);
            assert.strictEqual(options, fakeOptions);
        });
    });
    (0, mocha_1.describe)('schema', () => {
        function* toAsync(arr) {
            for (const i of arr) {
                yield i;
            }
        }
        (0, mocha_1.it)('should close the schema client when it has been opened', async () => {
            var _a, _b;
            // Force it to create a client.
            const client = await ((_a = pubsub.getSchemaClient_) === null || _a === void 0 ? void 0 : _a.call(pubsub));
            sandbox.stub(client, 'close').resolves();
            await ((_b = pubsub.close) === null || _b === void 0 ? void 0 : _b.call(pubsub));
        });
        // I feel like this ought to be a test, but something in getSchemaClient_()
        // is trying to talk to auth services, so I'm skipping it for now.
        /* it('getSchemaClient_ creates a schema client', async () => {
          const client = await pubsub.getSchemaClient_();
          assert.notStrictEqual(client, undefined);
          assert.notStrictEqual(client, null);
          await pubsub.close();
        }); */
        (0, mocha_1.it)('calls down to createSchema correctly', async () => {
            const schemaId = 'id';
            const type = src_1.SchemaTypes.Avro;
            const definition = 'def';
            const name = src_1.Schema.formatName_(pubsub.projectId, schemaId);
            // Grab the schema client it'll be using so we can stub it.
            const client = await pubsub.getSchemaClient_();
            const def = defer();
            sandbox.stub(client, 'createSchema').callsFake(req => {
                assert.strictEqual(req.parent, pubsub.name);
                assert.strictEqual(req.schemaId, schemaId);
                assert.strictEqual(req.schema.name, name);
                assert.strictEqual(req.schema.type, type);
                assert.strictEqual(req.schema.definition, definition);
                def.resolve();
            });
            const result = await Promise.all([
                pubsub.createSchema(schemaId, type, definition),
                def,
            ]);
            assert.strictEqual(result[0].id, schemaId);
        });
        (0, mocha_1.it)('calls down to listSchemas correctly', async () => {
            // Grab the schema client it'll be using so we can stub it.
            const client = await pubsub.getSchemaClient_();
            sandbox.stub(client, 'listSchemasAsync').callsFake((req, gaxOpts) => {
                assert.strictEqual(req.parent, pubsub.name);
                assert.strictEqual(req.view, 'BASIC');
                assert.deepStrictEqual(gaxOpts, {});
                return toAsync([
                    {
                        name: 'foo1',
                    },
                    {
                        name: 'foo2',
                    },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ]);
            });
            const ids = [];
            for await (const s of pubsub.listSchemas(schema_1.SchemaViews.Basic, {})) {
                ids.push(s.name);
            }
            const expectedIds = ['foo1', 'foo2'];
            assert.deepStrictEqual(ids, expectedIds);
        });
        (0, mocha_1.it)('defaults to BASIC for listSchemas', async () => {
            var _a;
            // Grab the schema client it'll be using so we can stub it.
            const client = await ((_a = pubsub.getSchemaClient_) === null || _a === void 0 ? void 0 : _a.call(pubsub));
            sandbox.stub(client, 'listSchemasAsync').callsFake(req => {
                assert.strictEqual(req.view, 'BASIC');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return toAsync([]);
            });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for await (const s of pubsub.listSchemas()) {
                break;
            }
        });
        (0, mocha_1.it)('returns a proper Schema object from schema()', async () => {
            var _a;
            const schema = (_a = pubsub.schema) === null || _a === void 0 ? void 0 : _a.call(pubsub, 'foo');
            assert.strictEqual(schema.id, 'foo');
            const name = await schema.getName();
            assert.strictEqual(name, src_1.Schema.formatName_(pubsub.projectId, 'foo'));
        });
        (0, mocha_1.it)('calls validateSchema() on the client when validateSchema() is called', async () => {
            const client = await pubsub.getSchemaClient_();
            const ischema = {
                name: 'test',
                type: src_1.SchemaTypes.Avro,
                definition: 'foo',
            };
            let called = false;
            sandbox
                .stub(client, 'validateSchema')
                .callsFake(async (params, gaxOpts) => {
                assert.strictEqual(params.parent, pubsub.name);
                assert.deepStrictEqual(params.schema, ischema);
                assert.ok(gaxOpts);
                called = true;
            });
            await pubsub.validateSchema(ischema, {});
            assert.ok(called);
        });
    });
});
//# sourceMappingURL=pubsub.js.map