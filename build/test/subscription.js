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
const assert = require("assert");
const mocha_1 = require("mocha");
const events_1 = require("events");
const proxyquire = require("proxyquire");
const sinon = require("sinon");
const subby = require("../src/subscription");
const util = require("../src/util");
let promisified = false;
const fakeUtil = Object.assign({}, util, {
    promisifySome(class_, classProtos, methods) {
        if (class_.name === 'Subscription') {
            promisified = true;
            assert.deepStrictEqual(methods, [
                'close',
                'create',
                'createSnapshot',
                'delete',
                'detached',
                'exists',
                'get',
                'getMetadata',
                'modifyPushConfig',
                'seek',
                'setMetadata',
            ]);
        }
        // Defeats the method name type check.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        util.promisifySome(class_, classProtos, methods);
    },
});
class FakeIAM {
    constructor() {
        // eslint-disable-next-line prefer-rest-params
        this.calledWith_ = arguments;
    }
}
class FakeSnapshot {
    constructor() {
        // eslint-disable-next-line prefer-rest-params
        this.calledWith_ = arguments;
    }
}
let subscriber;
class FakeSubscriber extends events_1.EventEmitter {
    constructor() {
        super();
        this.isOpen = false;
        // eslint-disable-next-line prefer-rest-params
        this.calledWith_ = arguments;
        subscriber = this;
    }
    open() {
        this.isOpen = true;
    }
    async close() {
        this.isOpen = false;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setOptions(options) { }
}
(0, mocha_1.describe)('Subscription', () => {
    // tslint:disable-next-line variable-name
    let Subscription;
    let subscription;
    const PROJECT_ID = 'test-project';
    const SUB_NAME = 'test-subscription';
    const SUB_FULL_NAME = 'projects/' + PROJECT_ID + '/subscriptions/' + SUB_NAME;
    const PUBSUB = {
        projectId: PROJECT_ID,
        request: util.noop,
        createSubscription: util.noop,
    };
    (0, mocha_1.before)(() => {
        Subscription = proxyquire('../src/subscription.js', {
            './util': fakeUtil,
            './iam.js': { IAM: FakeIAM },
            './snapshot.js': { Snapshot: FakeSnapshot },
            './subscriber.js': { Subscriber: FakeSubscriber },
        }).Subscription;
    });
    const sandbox = sinon.createSandbox();
    (0, mocha_1.beforeEach)(() => {
        PUBSUB.request = util.noop;
        subscription = new Subscription(PUBSUB, SUB_NAME);
    });
    (0, mocha_1.afterEach)(() => sandbox.restore());
    (0, mocha_1.describe)('initialization', () => {
        (0, mocha_1.it)('should promisify some of the things', () => {
            assert(promisified);
        });
        (0, mocha_1.it)('should localize the pubsub object', () => {
            assert.strictEqual(subscription.pubsub, PUBSUB);
        });
        (0, mocha_1.it)('should localize the project id', () => {
            assert.strictEqual(subscription.projectId, PROJECT_ID);
        });
        (0, mocha_1.it)('should localize pubsub request method', done => {
            PUBSUB.request = () => {
                done();
            };
            const subscription = new Subscription(PUBSUB, SUB_NAME);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            subscription.request(assert.ifError);
        });
        (0, mocha_1.it)('should format the sub name', () => {
            const formattedName = 'a/b/c/d';
            const formatName = Subscription.formatName_;
            Subscription.formatName_ = (projectId, name) => {
                assert.strictEqual(projectId, PROJECT_ID);
                assert.strictEqual(name, SUB_NAME);
                Subscription.formatName_ = formatName;
                return formattedName;
            };
            const subscription = new Subscription(PUBSUB, SUB_NAME);
            assert.strictEqual(subscription.name, formattedName);
        });
        (0, mocha_1.it)('should create an IAM object', () => {
            assert(subscription.iam instanceof FakeIAM);
            const args = subscription.iam.calledWith_;
            assert.strictEqual(args[0], PUBSUB);
            assert.strictEqual(args[1], subscription.name);
        });
        (0, mocha_1.it)('should create a Subscriber', () => {
            const options = {};
            const subscription = new Subscription(PUBSUB, SUB_NAME, options);
            const [sub, opts] = subscriber.calledWith_;
            assert.strictEqual(sub, subscription);
            assert.strictEqual(opts, options);
        });
        (0, mocha_1.it)('should open the subscriber when a listener is attached', () => {
            var _a;
            const stub = sandbox.stub(subscriber, 'open');
            (_a = subscription.on) === null || _a === void 0 ? void 0 : _a.call(subscription, 'message', () => { });
            assert.strictEqual(stub.callCount, 1);
        });
        (0, mocha_1.it)('should close the subscriber when no listeners are attached', () => {
            var _a, _b;
            const stub = sandbox.stub(subscriber, 'close');
            const cb = () => { };
            (_a = subscription.on) === null || _a === void 0 ? void 0 : _a.call(subscription, 'message', cb);
            (_b = subscription.removeListener) === null || _b === void 0 ? void 0 : _b.call(subscription, 'message', cb);
            assert.strictEqual(stub.callCount, 1);
        });
        (0, mocha_1.it)('should emit messages', done => {
            var _a;
            const message = {};
            (_a = subscription.on) === null || _a === void 0 ? void 0 : _a.call(subscription, 'message', (msg) => {
                assert.strictEqual(msg, message);
                done();
            });
            subscriber.emit('message', message);
        });
        (0, mocha_1.it)('should emit errors', done => {
            var _a;
            const error = new Error('err');
            (_a = subscription.on) === null || _a === void 0 ? void 0 : _a.call(subscription, 'error', (err) => {
                assert.strictEqual(err, error);
                done();
            });
            subscriber.emit('error', error);
        });
        (0, mocha_1.it)('should emit close events', done => {
            var _a;
            (_a = subscription.on) === null || _a === void 0 ? void 0 : _a.call(subscription, 'close', done);
            subscriber.emit('close');
        });
    });
    (0, mocha_1.describe)('formatMetadata_', () => {
        (0, mocha_1.it)('should make a copy of the metadata', () => {
            const metadata = { a: 'a' };
            const formatted = Subscription.formatMetadata_(metadata);
            assert.deepStrictEqual(metadata, formatted);
            assert.notStrictEqual(metadata, formatted);
        });
        (0, mocha_1.it)('should format messageRetentionDuration', () => {
            const threeDaysInSeconds = 3 * 24 * 60 * 60;
            const metadata = {
                messageRetentionDuration: threeDaysInSeconds,
            };
            const formatted = Subscription.formatMetadata_(metadata);
            assert.strictEqual(formatted.messageRetentionDuration.nanos, 0);
            assert.strictEqual(formatted.messageRetentionDuration.seconds, threeDaysInSeconds);
        });
        (0, mocha_1.it)('should format pushEndpoint', () => {
            const pushEndpoint = 'http://noop.com/push';
            const metadata = {
                pushEndpoint,
            };
            const formatted = Subscription.formatMetadata_(metadata);
            assert.strictEqual(formatted.pushConfig.pushEndpoint, pushEndpoint);
            assert.strictEqual(formatted.pushEndpoint, undefined);
        });
        (0, mocha_1.it)('should format oidcToken', () => {
            const oidcToken = {
                serviceAccount: 'pubsub-test@appspot.gserviceaccount.com',
                audience: 'audience',
            };
            const metadata = {
                oidcToken,
            };
            const formatted = Subscription.formatMetadata_(metadata);
            assert.strictEqual(formatted.pushConfig.oidcToken, oidcToken);
            assert.strictEqual(formatted.oidcToken, undefined);
        });
        (0, mocha_1.it)('should format both pushEndpoint and oidcToken', () => {
            const pushEndpoint = 'http://noop.com/push';
            const oidcToken = {
                serviceAccount: 'pubsub-test@appspot.gserviceaccount.com',
                audience: 'audience',
            };
            const metadata = {
                pushEndpoint,
                oidcToken,
            };
            const formatted = Subscription.formatMetadata_(metadata);
            assert.strictEqual(formatted.pushConfig.pushEndpoint, pushEndpoint);
            assert.strictEqual(formatted.pushEndpoint, undefined);
            assert.strictEqual(formatted.pushConfig.oidcToken, oidcToken);
            assert.strictEqual(formatted.oidcToken, undefined);
        });
    });
    (0, mocha_1.describe)('formatName_', () => {
        (0, mocha_1.it)('should format name', () => {
            const formattedName = Subscription.formatName_(PROJECT_ID, SUB_NAME);
            assert.strictEqual(formattedName, SUB_FULL_NAME);
        });
        (0, mocha_1.it)('should format name when given a complete name', () => {
            const formattedName = Subscription.formatName_(PROJECT_ID, SUB_FULL_NAME);
            assert.strictEqual(formattedName, SUB_FULL_NAME);
        });
    });
    (0, mocha_1.describe)('close', () => {
        (0, mocha_1.it)('should call the success callback', done => {
            var _a;
            sandbox.stub(subscriber, 'close').resolves();
            (_a = subscription.close) === null || _a === void 0 ? void 0 : _a.call(subscription, done);
        });
        (0, mocha_1.it)('should pass back any errors that occurs', done => {
            const fakeErr = new Error('err');
            sandbox.stub(subscriber, 'close').rejects(fakeErr);
            subscription.close((err) => {
                assert.strictEqual(err, fakeErr);
                done();
            });
        });
    });
    (0, mocha_1.describe)('create', () => {
        const TOPIC_NAME = 'hi-ho-silver';
        (0, mocha_1.beforeEach)(() => {
            subscription.topic = TOPIC_NAME;
        });
        (0, mocha_1.it)('should throw an error if there is no topic', async () => {
            const expectedError = /Subscriptions can only be created when accessed through Topics/;
            delete subscription.topic;
            await assert.rejects(subscription.create(), expectedError);
        });
        (0, mocha_1.it)('should pass the correct params', () => {
            var _a;
            const fakeOptions = {};
            const stub = sandbox.stub(PUBSUB, 'createSubscription');
            (_a = subscription.create) === null || _a === void 0 ? void 0 : _a.call(subscription, fakeOptions, assert.ifError);
            const [topic, name, options] = stub.lastCall.args;
            assert.strictEqual(topic, TOPIC_NAME);
            assert.strictEqual(name, SUB_NAME);
            assert.strictEqual(options, fakeOptions);
        });
        (0, mocha_1.it)('should optionally accept options', () => {
            var _a;
            const stub = sandbox.stub(PUBSUB, 'createSubscription');
            (_a = subscription.create) === null || _a === void 0 ? void 0 : _a.call(subscription, assert.ifError);
            const options = stub.lastCall.args[2];
            assert.deepStrictEqual(options, {});
        });
        (0, mocha_1.it)('should return any request errors', done => {
            var _a;
            const fakeErr = new Error('err');
            const fakeResponse = {};
            const stub = sandbox.stub(PUBSUB, 'createSubscription');
            (_a = subscription.create) === null || _a === void 0 ? void 0 : _a.call(subscription, (err, sub, resp) => {
                assert.strictEqual(err, fakeErr);
                assert.strictEqual(sub, null);
                assert.strictEqual(resp, fakeResponse);
                done();
            });
            const callback = stub.lastCall.args[3];
            setImmediate(callback, fakeErr, null, fakeResponse);
        });
        (0, mocha_1.it)('should update the subscription', done => {
            var _a;
            const stub = sandbox.stub(PUBSUB, 'createSubscription');
            const fakeSub = new Subscription(PUBSUB, SUB_FULL_NAME);
            const fakeResponse = {};
            (_a = subscription.create) === null || _a === void 0 ? void 0 : _a.call(subscription, err => {
                assert.ifError(err);
                assert.strictEqual(subscription.metadata, fakeResponse);
                done();
            });
            const callback = stub.lastCall.args[3];
            fakeSub.metadata = fakeResponse;
            setImmediate(callback, null, fakeSub, fakeResponse);
        });
        (0, mocha_1.it)('should pass back all the things', done => {
            var _a;
            const fakeResponse = {};
            const stub = sandbox.stub(PUBSUB, 'createSubscription');
            (_a = subscription.create) === null || _a === void 0 ? void 0 : _a.call(subscription, (err, sub, resp) => {
                assert.ifError(err);
                assert.strictEqual(sub, subscription);
                assert.strictEqual(resp, fakeResponse);
                done();
            });
            const callback = stub.lastCall.args[3];
            setImmediate(callback, null, null, fakeResponse);
        });
    });
    (0, mocha_1.describe)('createSnapshot', () => {
        const SNAPSHOT_NAME = 'test-snapshot';
        (0, mocha_1.beforeEach)(() => {
            subscription.snapshot = (name) => {
                return {
                    name,
                };
            };
        });
        (0, mocha_1.it)('should throw an error if a snapshot name is not found', async () => {
            await assert.rejects(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return subscription.createSnapshot();
            }, /A name is required to create a snapshot\./);
        });
        (0, mocha_1.it)('should make the correct request', done => {
            var _a;
            subscription.request = config => {
                assert.strictEqual(config.client, 'SubscriberClient');
                assert.strictEqual(config.method, 'createSnapshot');
                assert.deepStrictEqual(config.reqOpts, {
                    name: SNAPSHOT_NAME,
                    subscription: subscription.name,
                });
                done();
            };
            (_a = subscription.createSnapshot) === null || _a === void 0 ? void 0 : _a.call(subscription, SNAPSHOT_NAME, assert.ifError);
        });
        (0, mocha_1.it)('should optionally accept gax options', done => {
            var _a;
            const gaxOpts = {};
            subscription.request = config => {
                assert.strictEqual(config.gaxOpts, gaxOpts);
                done();
            };
            (_a = subscription.createSnapshot) === null || _a === void 0 ? void 0 : _a.call(subscription, SNAPSHOT_NAME, gaxOpts, assert.ifError);
        });
        (0, mocha_1.it)('should pass back any errors to the callback', done => {
            var _a;
            const error = new Error('err');
            const apiResponse = {};
            subscription.request = (config, callback) => {
                callback(error, apiResponse);
            };
            (_a = subscription.createSnapshot) === null || _a === void 0 ? void 0 : _a.call(subscription, SNAPSHOT_NAME, (err, snapshot, resp) => {
                assert.strictEqual(err, error);
                assert.strictEqual(snapshot, null);
                assert.strictEqual(resp, apiResponse);
                done();
            });
        });
        (0, mocha_1.it)('should return a snapshot object with metadata', done => {
            var _a;
            const apiResponse = {};
            const fakeSnapshot = {};
            subscription.snapshot = () => {
                return fakeSnapshot;
            };
            subscription.request = (config, callback) => {
                callback(null, apiResponse);
            };
            (_a = subscription.createSnapshot) === null || _a === void 0 ? void 0 : _a.call(subscription, SNAPSHOT_NAME, (err, snapshot, resp) => {
                assert.ifError(err);
                assert.strictEqual(snapshot, fakeSnapshot);
                assert.strictEqual(snapshot.metadata, apiResponse);
                assert.strictEqual(resp, apiResponse);
                done();
            });
        });
    });
    (0, mocha_1.describe)('debug', () => {
        const error = new Error('err');
        (0, mocha_1.beforeEach)(() => {
            subscription.request = (config, callback) => {
                callback(error);
            };
        });
        (0, mocha_1.it)('should return the debug events to the callback', done => {
            var _a;
            (_a = subscription.on) === null || _a === void 0 ? void 0 : _a.call(subscription, 'debug', err => {
                assert.strictEqual(err, error);
                done();
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            subscription._subscriber.emit('debug', error);
        });
    });
    (0, mocha_1.describe)('delete', () => {
        (0, mocha_1.beforeEach)(() => {
            sandbox.stub(subscription, 'removeAllListeners').yields(util.noop);
            sandbox.stub(subscription, 'close').yields(util.noop);
        });
        (0, mocha_1.it)('should make the correct request', done => {
            var _a;
            subscription.request = (config) => {
                assert.strictEqual(config.client, 'SubscriberClient');
                assert.strictEqual(config.method, 'deleteSubscription');
                assert.deepStrictEqual(config.reqOpts, {
                    subscription: subscription.name,
                });
                done();
            };
            (_a = subscription.delete) === null || _a === void 0 ? void 0 : _a.call(subscription, assert.ifError);
        });
        (0, mocha_1.it)('should optionally accept gax options', done => {
            var _a;
            const gaxOpts = {};
            subscription.request = (config) => {
                assert.strictEqual(config.gaxOpts, gaxOpts);
                done();
            };
            (_a = subscription.delete) === null || _a === void 0 ? void 0 : _a.call(subscription, gaxOpts, assert.ifError);
        });
        (0, mocha_1.describe)('success', () => {
            const apiResponse = {};
            (0, mocha_1.beforeEach)(() => {
                subscription.request = (config, callback) => {
                    callback(null, apiResponse);
                };
            });
            (0, mocha_1.it)('should return the api response', done => {
                var _a;
                (_a = subscription.delete) === null || _a === void 0 ? void 0 : _a.call(subscription, (err, resp) => {
                    assert.ifError(err);
                    assert.strictEqual(resp, apiResponse);
                    done();
                });
            });
            (0, mocha_1.it)('should close the subscriber if open', done => {
                var _a, _b;
                const stub = sandbox.stub(subscriber, 'close');
                (_a = subscription.open) === null || _a === void 0 ? void 0 : _a.call(subscription);
                (_b = subscription.delete) === null || _b === void 0 ? void 0 : _b.call(subscription, err => {
                    assert.ifError(err);
                    assert.strictEqual(stub.callCount, 1);
                    done();
                });
            });
        });
        (0, mocha_1.describe)('error', () => {
            const error = new Error('err');
            (0, mocha_1.beforeEach)(() => {
                subscription.request = (config, callback) => {
                    callback(error);
                };
            });
            (0, mocha_1.it)('should return the error to the callback', done => {
                var _a;
                (_a = subscription.delete) === null || _a === void 0 ? void 0 : _a.call(subscription, err => {
                    assert.strictEqual(err, error);
                    done();
                });
            });
            (0, mocha_1.it)('should not remove all the listeners', done => {
                var _a;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                subscription.removeAllListeners = () => {
                    done(new Error('Should not be called.'));
                };
                (_a = subscription.delete) === null || _a === void 0 ? void 0 : _a.call(subscription, () => {
                    done();
                });
            });
            (0, mocha_1.it)('should not close the subscription', done => {
                var _a;
                subscription.close = async () => {
                    done(new Error('Should not be called.'));
                };
                (_a = subscription.delete) === null || _a === void 0 ? void 0 : _a.call(subscription, () => {
                    done();
                });
            });
        });
    });
    (0, mocha_1.describe)('exists', () => {
        (0, mocha_1.it)('should return true if it finds metadata', done => {
            var _a;
            sandbox.stub(subscription, 'getMetadata').yields(null, {});
            (_a = subscription.exists) === null || _a === void 0 ? void 0 : _a.call(subscription, (err, exists) => {
                assert.ifError(err);
                assert(exists);
                done();
            });
        });
        (0, mocha_1.it)('should return false if a not found error occurs', done => {
            var _a;
            const error = { code: 5 };
            sandbox.stub(subscription, 'getMetadata').yields(error);
            (_a = subscription.exists) === null || _a === void 0 ? void 0 : _a.call(subscription, (err, exists) => {
                assert.ifError(err);
                assert.strictEqual(exists, false);
                done();
            });
        });
        (0, mocha_1.it)('should pass back any other type of error', done => {
            var _a;
            const error = { code: 4 };
            sandbox.stub(subscription, 'getMetadata').yields(error);
            (_a = subscription.exists) === null || _a === void 0 ? void 0 : _a.call(subscription, (err, exists) => {
                assert.strictEqual(err, error);
                assert.strictEqual(exists, undefined);
                done();
            });
        });
    });
    (0, mocha_1.describe)('get', () => {
        (0, mocha_1.it)('should delete the autoCreate option', done => {
            var _a;
            const options = {
                autoCreate: true,
                a: 'a',
            };
            sandbox.stub(subscription, 'getMetadata').callsFake(gaxOpts => {
                assert.strictEqual(gaxOpts, options);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                assert.strictEqual(gaxOpts.autoCreate, undefined);
                done();
            });
            (_a = subscription.get) === null || _a === void 0 ? void 0 : _a.call(subscription, options, assert.ifError);
        });
        (0, mocha_1.describe)('success', () => {
            const fakeMetadata = {};
            (0, mocha_1.it)('should call through to getMetadata', done => {
                var _a;
                sandbox
                    .stub(subscription, 'getMetadata')
                    .callsFake((gaxOpts, callback) => {
                    callback(null, fakeMetadata);
                });
                (_a = subscription.get) === null || _a === void 0 ? void 0 : _a.call(subscription, (err, sub, resp) => {
                    assert.ifError(err);
                    assert.strictEqual(sub, subscription);
                    assert.strictEqual(resp, fakeMetadata);
                    done();
                });
            });
            (0, mocha_1.it)('should optionally accept options', done => {
                var _a;
                const options = {};
                sandbox
                    .stub(subscription, 'getMetadata')
                    .callsFake((gaxOpts, callback) => {
                    assert.strictEqual(gaxOpts, options);
                    callback(null); // the done fn
                });
                (_a = subscription.get) === null || _a === void 0 ? void 0 : _a.call(subscription, options, done);
            });
        });
        (0, mocha_1.describe)('error', () => {
            (0, mocha_1.it)('should pass back errors when not auto-creating', done => {
                var _a;
                const error = { code: 4 };
                const apiResponse = {};
                sandbox
                    .stub(subscription, 'getMetadata')
                    .callsArgWith(1, error, apiResponse);
                (_a = subscription.get) === null || _a === void 0 ? void 0 : _a.call(subscription, (err, sub, resp) => {
                    assert.strictEqual(err, error);
                    assert.strictEqual(sub, null);
                    assert.strictEqual(resp, apiResponse);
                    done();
                });
            });
            (0, mocha_1.it)('should pass back 404 errors if autoCreate is false', done => {
                var _a;
                const error = { code: 5 };
                const apiResponse = {};
                sandbox
                    .stub(subscription, 'getMetadata')
                    .callsArgWith(1, error, apiResponse);
                (_a = subscription.get) === null || _a === void 0 ? void 0 : _a.call(subscription, (err, sub, resp) => {
                    assert.strictEqual(err, error);
                    assert.strictEqual(sub, null);
                    assert.strictEqual(resp, apiResponse);
                    done();
                });
            });
            (0, mocha_1.it)('should pass back 404 errors if create doesnt exist', done => {
                var _a;
                const error = { code: 5 };
                const apiResponse = {};
                sandbox
                    .stub(subscription, 'getMetadata')
                    .callsArgWith(1, error, apiResponse);
                delete subscription.create;
                (_a = subscription.get) === null || _a === void 0 ? void 0 : _a.call(subscription, (err, sub, resp) => {
                    assert.strictEqual(err, error);
                    assert.strictEqual(sub, null);
                    assert.strictEqual(resp, apiResponse);
                    done();
                });
            });
            (0, mocha_1.it)('should create the sub if 404 + autoCreate is true', done => {
                var _a;
                const error = { code: 5 };
                const apiResponse = {};
                const fakeOptions = {
                    autoCreate: true,
                };
                sandbox
                    .stub(subscription, 'getMetadata')
                    .callsArgWith(1, error, apiResponse);
                sandbox.stub(subscription, 'create').callsFake(options => {
                    assert.strictEqual(options.gaxOpts, fakeOptions);
                    done();
                });
                subscription.topic = 'hi-ho-silver';
                (_a = subscription.get) === null || _a === void 0 ? void 0 : _a.call(subscription, fakeOptions, assert.ifError);
            });
        });
    });
    (0, mocha_1.describe)('getMetadata', () => {
        (0, mocha_1.it)('should make the correct request', done => {
            var _a;
            subscription.request = config => {
                assert.strictEqual(config.client, 'SubscriberClient');
                assert.strictEqual(config.method, 'getSubscription');
                assert.deepStrictEqual(config.reqOpts, {
                    subscription: subscription.name,
                });
                done();
            };
            (_a = subscription.getMetadata) === null || _a === void 0 ? void 0 : _a.call(subscription, assert.ifError);
        });
        (0, mocha_1.it)('should optionally accept gax options', done => {
            var _a;
            const gaxOpts = {};
            subscription.request = config => {
                assert.strictEqual(config.gaxOpts, gaxOpts);
                done();
            };
            (_a = subscription.getMetadata) === null || _a === void 0 ? void 0 : _a.call(subscription, gaxOpts, assert.ifError);
        });
        (0, mocha_1.it)('should pass back any errors that occur', done => {
            var _a;
            const error = new Error('err');
            const apiResponse = {};
            subscription.request = (config, callback) => {
                callback(error, apiResponse);
            };
            (_a = subscription.getMetadata) === null || _a === void 0 ? void 0 : _a.call(subscription, (err, metadata) => {
                assert.strictEqual(err, error);
                assert.strictEqual(metadata, apiResponse);
                done();
            });
        });
        (0, mocha_1.it)('should set the metadata if no error occurs', done => {
            var _a;
            const apiResponse = {};
            subscription.request = (config, callback) => {
                callback(null, apiResponse);
            };
            (_a = subscription.getMetadata) === null || _a === void 0 ? void 0 : _a.call(subscription, (err, metadata) => {
                assert.ifError(err);
                assert.strictEqual(metadata, apiResponse);
                assert.strictEqual(subscription.metadata, apiResponse);
                done();
            });
        });
    });
    (0, mocha_1.describe)('modifyPushConfig', () => {
        const fakeConfig = {};
        (0, mocha_1.it)('should make the correct request', done => {
            var _a;
            subscription.request = config => {
                assert.strictEqual(config.client, 'SubscriberClient');
                assert.strictEqual(config.method, 'modifyPushConfig');
                assert.deepStrictEqual(config.reqOpts, {
                    subscription: subscription.name,
                    pushConfig: fakeConfig,
                });
                done();
            };
            (_a = subscription.modifyPushConfig) === null || _a === void 0 ? void 0 : _a.call(subscription, fakeConfig, assert.ifError);
        });
        (0, mocha_1.it)('should optionally accept gaxOpts', done => {
            var _a;
            const gaxOpts = {};
            subscription.request = config => {
                assert.strictEqual(config.gaxOpts, gaxOpts);
                done();
            };
            (_a = subscription.modifyPushConfig) === null || _a === void 0 ? void 0 : _a.call(subscription, fakeConfig, gaxOpts, assert.ifError);
        });
    });
    (0, mocha_1.describe)('open', () => {
        (0, mocha_1.it)('should open the subscriber', () => {
            var _a;
            const stub = sandbox.stub(subscriber, 'open');
            (_a = subscription.open) === null || _a === void 0 ? void 0 : _a.call(subscription);
            assert.strictEqual(stub.callCount, 1);
        });
        (0, mocha_1.it)('should noop if already open', () => {
            var _a, _b;
            const spy = sandbox.spy(subscriber, 'open');
            (_a = subscription.open) === null || _a === void 0 ? void 0 : _a.call(subscription);
            (_b = subscription.open) === null || _b === void 0 ? void 0 : _b.call(subscription);
            assert.strictEqual(spy.callCount, 1);
        });
    });
    (0, mocha_1.describe)('seek', () => {
        const FAKE_SNAPSHOT_NAME = 'a';
        const FAKE_FULL_SNAPSHOT_NAME = 'a/b/c/d';
        (0, mocha_1.beforeEach)(() => {
            FakeSnapshot.formatName_ = () => {
                return FAKE_FULL_SNAPSHOT_NAME;
            };
        });
        (0, mocha_1.it)('should throw if a name or date is not provided', async () => {
            await assert.rejects(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return subscription.seek();
            }, /Either a snapshot name or Date is needed to seek to\./);
        });
        (0, mocha_1.it)('should make the correct api request', done => {
            var _a;
            FakeSnapshot.formatName_ = (projectId, name) => {
                assert.strictEqual(projectId, PROJECT_ID);
                assert.strictEqual(name, FAKE_SNAPSHOT_NAME);
                return FAKE_FULL_SNAPSHOT_NAME;
            };
            subscription.request = (config) => {
                assert.strictEqual(config.client, 'SubscriberClient');
                assert.strictEqual(config.method, 'seek');
                assert.deepStrictEqual(config.reqOpts, {
                    subscription: subscription.name,
                    snapshot: FAKE_FULL_SNAPSHOT_NAME,
                });
                done();
            };
            (_a = subscription.seek) === null || _a === void 0 ? void 0 : _a.call(subscription, FAKE_SNAPSHOT_NAME, assert.ifError);
        });
        (0, mocha_1.it)('should optionally accept a Date object', done => {
            var _a;
            const date = new Date();
            const reqOpts = {
                subscription: SUB_FULL_NAME,
                time: {
                    seconds: Math.floor(date.getTime() / 1000),
                    nanos: Math.floor(date.getTime() % 1000) * 1000,
                },
            };
            subscription.request = (config) => {
                assert.deepStrictEqual(config.reqOpts, reqOpts);
                done();
            };
            (_a = subscription.seek) === null || _a === void 0 ? void 0 : _a.call(subscription, date, assert.ifError);
        });
        (0, mocha_1.it)('should optionally accept gax options', done => {
            var _a;
            const gaxOpts = {};
            subscription.request = (config) => {
                assert.strictEqual(config.gaxOpts, gaxOpts);
                done();
            };
            (_a = subscription.seek) === null || _a === void 0 ? void 0 : _a.call(subscription, FAKE_SNAPSHOT_NAME, gaxOpts, assert.ifError);
        });
    });
    (0, mocha_1.describe)('setMetadata', () => {
        const METADATA = {
            pushEndpoint: 'http://noop.com/push',
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subClass = subby.Subscription;
        (0, mocha_1.beforeEach)(() => {
            subClass.formatMetadata_ = (metadata) => {
                return Object.assign({}, metadata);
            };
        });
        (0, mocha_1.it)('should make the correct request', done => {
            var _a;
            const formattedMetadata = {
                pushConfig: {
                    pushEndpoint: METADATA.pushEndpoint,
                },
            };
            const expectedBody = Object.assign({
                name: SUB_FULL_NAME,
            }, formattedMetadata);
            Subscription.formatMetadata_ = metadata => {
                assert.strictEqual(metadata, METADATA);
                return formattedMetadata;
            };
            const reqOpts = {
                subscription: expectedBody,
                updateMask: {
                    paths: ['push_config'],
                },
            };
            subscription.request = (config) => {
                assert.strictEqual(config.client, 'SubscriberClient');
                assert.strictEqual(config.method, 'updateSubscription');
                assert.deepStrictEqual(config.reqOpts, reqOpts);
                done();
            };
            (_a = subscription.setMetadata) === null || _a === void 0 ? void 0 : _a.call(subscription, METADATA, done);
        });
        (0, mocha_1.it)('should optionally accept gax options', done => {
            var _a;
            const gaxOpts = {};
            subscription.request = (config) => {
                assert.strictEqual(config.gaxOpts, gaxOpts);
                done();
            };
            (_a = subscription.setMetadata) === null || _a === void 0 ? void 0 : _a.call(subscription, METADATA, gaxOpts, done);
        });
    });
    (0, mocha_1.describe)('setOptions', () => {
        (0, mocha_1.it)('should pass the options to the subscriber', () => {
            var _a;
            const options = {};
            const stub = sandbox.stub(subscriber, 'setOptions').withArgs(options);
            (_a = subscription.setOptions) === null || _a === void 0 ? void 0 : _a.call(subscription, options);
            assert.strictEqual(stub.callCount, 1);
        });
    });
    (0, mocha_1.describe)('snapshot', () => {
        const SNAPSHOT_NAME = 'a';
        (0, mocha_1.it)('should call through to pubsub.snapshot', done => {
            var _a;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            PUBSUB.snapshot = function (name) {
                assert.strictEqual(this, subscription);
                assert.strictEqual(name, SNAPSHOT_NAME);
                done();
            };
            (_a = subscription.snapshot) === null || _a === void 0 ? void 0 : _a.call(subscription, SNAPSHOT_NAME);
        });
    });
});
//# sourceMappingURL=subscription.js.map