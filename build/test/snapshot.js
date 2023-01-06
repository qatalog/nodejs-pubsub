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
const proxyquire = require("proxyquire");
const sinon = require("sinon");
const pubsub_1 = require("../src/pubsub");
const util = require("../src/util");
let promisified = false;
const fakeUtil = Object.assign({}, util, {
    promisifySome(class_, classProtos, methods) {
        if (class_.name === 'Snapshot') {
            promisified = true;
            assert.deepStrictEqual(methods, ['delete', 'create', 'seek']);
        }
        // Defeats the method name type check.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        util.promisifySome(class_, classProtos, methods);
    },
});
(0, mocha_1.describe)('Snapshot', () => {
    // tslint:disable-next-line variable-name
    let Snapshot;
    let snapshot;
    const SNAPSHOT_NAME = 'a';
    const PROJECT_ID = 'grape-spaceship-123';
    const PUBSUB = {
        projectId: PROJECT_ID,
    };
    const SUBSCRIPTION = {
        projectId: PROJECT_ID,
        pubsub: PUBSUB,
        api: {},
        createSnapshot() { },
        seek() { },
    };
    (0, mocha_1.before)(() => {
        Snapshot = proxyquire('../src/snapshot', {
            './util': fakeUtil,
        }).Snapshot;
    });
    const sandbox = sinon.createSandbox();
    (0, mocha_1.beforeEach)(() => {
        snapshot = new Snapshot(SUBSCRIPTION, SNAPSHOT_NAME);
    });
    (0, mocha_1.afterEach)(() => sandbox.restore());
    (0, mocha_1.describe)('initialization', () => {
        const FULL_SNAPSHOT_NAME = 'a/b/c/d';
        let formatName_;
        (0, mocha_1.before)(() => {
            formatName_ = Snapshot.formatName_;
            Snapshot.formatName_ = () => {
                return FULL_SNAPSHOT_NAME;
            };
        });
        (0, mocha_1.after)(() => {
            Snapshot.formatName_ = formatName_;
        });
        (0, mocha_1.it)('should promisify some of the things', () => {
            assert(promisified);
        });
        (0, mocha_1.it)('should localize the parent', () => {
            assert.strictEqual(snapshot.parent, SUBSCRIPTION);
        });
        (0, mocha_1.describe)('name', () => {
            (0, mocha_1.it)('should create and cache the full name', () => {
                Snapshot.formatName_ = (projectId, name) => {
                    assert.strictEqual(projectId, PROJECT_ID);
                    assert.strictEqual(name, SNAPSHOT_NAME);
                    return FULL_SNAPSHOT_NAME;
                };
                const snapshot = new Snapshot(SUBSCRIPTION, SNAPSHOT_NAME);
                assert.strictEqual(snapshot.name, FULL_SNAPSHOT_NAME);
            });
            (0, mocha_1.it)('should pull the projectId from parent object', () => {
                Snapshot.formatName_ = (projectId, name) => {
                    assert.strictEqual(projectId, PROJECT_ID);
                    assert.strictEqual(name, SNAPSHOT_NAME);
                    return FULL_SNAPSHOT_NAME;
                };
                const snapshot = new Snapshot(SUBSCRIPTION, SNAPSHOT_NAME);
                assert.strictEqual(snapshot.name, FULL_SNAPSHOT_NAME);
            });
        });
        (0, mocha_1.describe)('with Subscription parent', () => {
            let pubsub;
            let subscription;
            (0, mocha_1.before)(() => {
                pubsub = new pubsub_1.PubSub({ projectId: PROJECT_ID });
                subscription = pubsub.subscription('test');
            });
            (0, mocha_1.describe)('create', () => {
                (0, mocha_1.beforeEach)(() => {
                    snapshot = new Snapshot(subscription, SNAPSHOT_NAME);
                });
                (0, mocha_1.it)('should call createSnapshot', done => {
                    const fakeOpts = {};
                    sandbox
                        .stub(subscription, 'createSnapshot')
                        .callsFake((name, options) => {
                        assert.strictEqual(name, FULL_SNAPSHOT_NAME);
                        assert.strictEqual(options, fakeOpts);
                        done();
                    });
                    snapshot.create(fakeOpts, assert.ifError);
                });
                (0, mocha_1.it)('should return any request errors', done => {
                    const fakeError = new Error('err');
                    const fakeResponse = {};
                    const stub = sandbox.stub(subscription, 'createSnapshot');
                    snapshot.create((err, snap, resp) => {
                        assert.strictEqual(err, fakeError);
                        assert.strictEqual(snap, null);
                        assert.strictEqual(resp, fakeResponse);
                        done();
                    });
                    const callback = stub.lastCall.args[2];
                    setImmediate(callback, fakeError, null, fakeResponse);
                });
                (0, mocha_1.it)('should return the correct snapshot', done => {
                    const fakeSnapshot = new Snapshot(SUBSCRIPTION, SNAPSHOT_NAME);
                    const fakeResponse = {};
                    const stub = sandbox.stub(subscription, 'createSnapshot');
                    snapshot.create((err, snap, resp) => {
                        assert.ifError(err);
                        assert.strictEqual(snap, snapshot);
                        assert.strictEqual(resp, fakeResponse);
                        done();
                    });
                    const callback = stub.lastCall.args[2];
                    setImmediate(callback, null, fakeSnapshot, fakeResponse);
                });
            });
            (0, mocha_1.it)('should call the seek method', done => {
                sandbox.stub(subscription, 'seek').callsFake(snapshot => {
                    assert.strictEqual(snapshot, FULL_SNAPSHOT_NAME);
                    done();
                });
                const snapshot = new Snapshot(subscription, SNAPSHOT_NAME);
                snapshot.seek(assert.ifError);
            });
        });
        (0, mocha_1.describe)('with PubSub parent', () => {
            (0, mocha_1.beforeEach)(() => {
                snapshot = new Snapshot(PUBSUB, SNAPSHOT_NAME);
            });
            (0, mocha_1.it)('should throw on create method', async () => {
                await assert.rejects(() => snapshot.create(), /This is only available if you accessed this object through Subscription#snapshot/);
            });
            (0, mocha_1.it)('should throw on seek method', async () => {
                await assert.rejects(() => snapshot.seek(), /This is only available if you accessed this object through Subscription#snapshot/);
            });
        });
    });
    (0, mocha_1.describe)('formatName_', () => {
        const EXPECTED = 'projects/' + PROJECT_ID + '/snapshots/' + SNAPSHOT_NAME;
        (0, mocha_1.it)('should format the name', () => {
            const name = Snapshot.formatName_(PROJECT_ID, SNAPSHOT_NAME);
            assert.strictEqual(name, EXPECTED);
        });
        (0, mocha_1.it)('should not re-format the name', () => {
            const name = Snapshot.formatName_(PROJECT_ID, EXPECTED);
            assert.strictEqual(name, EXPECTED);
        });
    });
    (0, mocha_1.describe)('delete', () => {
        (0, mocha_1.it)('should make the correct request', done => {
            snapshot.parent.request = (config, callback) => {
                assert.strictEqual(config.client, 'SubscriberClient');
                assert.strictEqual(config.method, 'deleteSnapshot');
                assert.deepStrictEqual(config.reqOpts, { snapshot: snapshot.name });
                callback(); // the done fn
            };
            snapshot.delete(done);
        });
    });
});
//# sourceMappingURL=snapshot.js.map