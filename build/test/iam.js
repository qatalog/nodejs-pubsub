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
const util = require("../src/util");
let promisified = false;
const fakeUtil = Object.assign({}, util, {
    promisifySome(class_, classProtos, methods) {
        if (class_.name === 'IAM') {
            promisified = true;
            assert.deepStrictEqual(methods, [
                'getPolicy',
                'setPolicy',
                'testPermissions',
            ]);
        }
        // Defeats the method name type check.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        util.promisifySome(class_, classProtos, methods);
    },
});
(0, mocha_1.describe)('IAM', () => {
    let IAM;
    let iam;
    const PUBSUB = {
        options: {},
        request: util.noop,
    };
    const ID = 'id';
    (0, mocha_1.before)(() => {
        IAM = proxyquire('../src/iam.js', {
            './util': fakeUtil,
        }).IAM;
    });
    (0, mocha_1.beforeEach)(() => {
        iam = new IAM(PUBSUB, ID);
    });
    (0, mocha_1.describe)('initialization', () => {
        (0, mocha_1.it)('should localize pubsub', () => {
            assert.strictEqual(iam.pubsub, PUBSUB);
        });
        (0, mocha_1.it)('should localize pubsub#request', () => {
            const fakeRequest = () => { };
            const fakePubsub = {
                request: {
                    bind(context) {
                        assert.strictEqual(context, fakePubsub);
                        return fakeRequest;
                    },
                },
            };
            const iam = new IAM(fakePubsub, ID);
            assert.strictEqual(iam.request, fakeRequest);
        });
        (0, mocha_1.it)('should localize the ID', () => {
            assert.strictEqual(iam.id, ID);
        });
        (0, mocha_1.it)('should promisify some of the things', () => {
            assert(promisified);
        });
    });
    (0, mocha_1.describe)('getPolicy', () => {
        (0, mocha_1.it)('should make the correct API request', done => {
            iam.request = config => {
                const reqOpts = { resource: iam.id };
                assert.strictEqual(config.client, 'SubscriberClient');
                assert.strictEqual(config.method, 'getIamPolicy');
                assert.deepStrictEqual(config.reqOpts, reqOpts);
                done();
            };
            iam.getPolicy(assert.ifError);
        });
        (0, mocha_1.it)('should accept gax options', done => {
            const gaxOpts = {};
            iam.request = config => {
                assert.strictEqual(config.gaxOpts, gaxOpts);
                done();
            };
            iam.getPolicy(gaxOpts, assert.ifError);
        });
    });
    (0, mocha_1.describe)('setPolicy', () => {
        const policy = { etag: 'ACAB', bindings: [] };
        (0, mocha_1.it)('should throw an error if a policy is not supplied', () => {
            assert.throws(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                iam.setPolicy(util.noop);
            }, /A policy object is required\./);
        });
        (0, mocha_1.it)('should make the correct API request', done => {
            iam.request = config => {
                const reqOpts = { resource: iam.id, policy };
                assert.strictEqual(config.client, 'SubscriberClient');
                assert.strictEqual(config.method, 'setIamPolicy');
                assert.deepStrictEqual(config.reqOpts, reqOpts);
                done();
            };
            iam.setPolicy(policy, assert.ifError);
        });
        (0, mocha_1.it)('should accept gax options', done => {
            const gaxOpts = {};
            iam.request = (config) => {
                assert.strictEqual(config.gaxOpts, gaxOpts);
                done();
            };
            iam.setPolicy(policy, gaxOpts, assert.ifError);
        });
    });
    (0, mocha_1.describe)('testPermissions', () => {
        (0, mocha_1.it)('should throw an error if permissions are missing', () => {
            assert.throws(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                iam.testPermissions(util.noop);
            }, /Permissions are required\./);
        });
        (0, mocha_1.it)('should make the correct API request', done => {
            const permissions = 'storage.bucket.list';
            const reqOpts = { resource: iam.id, permissions: [permissions] };
            iam.request = config => {
                assert.strictEqual(config.client, 'SubscriberClient');
                assert.strictEqual(config.method, 'testIamPermissions');
                assert.deepStrictEqual(config.reqOpts, reqOpts);
                done();
            };
            iam.testPermissions(permissions, assert.ifError);
        });
        (0, mocha_1.it)('should accept gax options', done => {
            const permissions = 'storage.bucket.list';
            const gaxOpts = {};
            iam.request = config => {
                assert.strictEqual(config.gaxOpts, gaxOpts);
                done();
            };
            iam.testPermissions(permissions, gaxOpts, assert.ifError);
        });
        (0, mocha_1.it)('should send an error back if the request fails', done => {
            const permissions = ['storage.bucket.list'];
            const error = new Error('Error.');
            const apiResponse = {};
            iam.request = (config, callback) => {
                callback(error, apiResponse);
            };
            iam.testPermissions(permissions, (err, permissions, apiResp) => {
                assert.strictEqual(err, error);
                assert.strictEqual(permissions, null);
                assert.strictEqual(apiResp, apiResponse);
                done();
            });
        });
        (0, mocha_1.it)('should pass back a hash of permissions the user has', done => {
            const permissions = ['storage.bucket.list', 'storage.bucket.consume'];
            const apiResponse = {
                permissions: ['storage.bucket.consume'],
            };
            iam.request = (config, callback) => {
                callback(null, apiResponse);
            };
            iam.testPermissions(permissions, (err, permissions, apiResp) => {
                assert.ifError(err);
                assert.deepStrictEqual(permissions, {
                    'storage.bucket.list': false,
                    'storage.bucket.consume': true,
                });
                assert.strictEqual(apiResp, apiResponse);
                done();
            });
        });
    });
});
//# sourceMappingURL=iam.js.map