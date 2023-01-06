"use strict";
// Copyright 2019 Google LLC
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
const sinon = require("sinon");
const mocha_1 = require("mocha");
const google_gax_1 = require("google-gax");
const pull_retry_1 = require("../src/pull-retry");
(0, mocha_1.describe)('PullRetry', () => {
    const sandbox = sinon.createSandbox();
    let retrier;
    (0, mocha_1.beforeEach)(() => {
        retrier = new pull_retry_1.PullRetry();
    });
    (0, mocha_1.afterEach)(() => {
        sandbox.restore();
    });
    (0, mocha_1.describe)('createTimeout', () => {
        (0, mocha_1.it)('should return 0 when no failures have occurred', () => {
            assert.strictEqual(retrier.createTimeout(), 0);
        });
        (0, mocha_1.it)('should use a backoff factoring in the failure count', () => {
            const random = Math.random();
            const expected = Math.pow(2, 1) * 1000 + Math.floor(random * 1000);
            sandbox.stub(global.Math, 'random').returns(random);
            retrier.retry({ code: google_gax_1.grpc.status.CANCELLED });
            assert.strictEqual(retrier.createTimeout(), expected);
        });
    });
    (0, mocha_1.describe)('retry', () => {
        (0, mocha_1.it)('should return true for retryable errors', () => {
            [
                google_gax_1.grpc.status.DEADLINE_EXCEEDED,
                google_gax_1.grpc.status.RESOURCE_EXHAUSTED,
                google_gax_1.grpc.status.ABORTED,
                google_gax_1.grpc.status.INTERNAL,
                google_gax_1.grpc.status.UNAVAILABLE,
            ].forEach((code) => {
                const shouldRetry = retrier.retry({ code });
                assert.strictEqual(shouldRetry, true);
            });
            const serverShutdown = retrier.retry({
                code: google_gax_1.grpc.status.UNAVAILABLE,
                details: 'Server shutdownNow invoked',
            });
            assert.strictEqual(serverShutdown, true);
        });
        (0, mocha_1.it)('should return false for non-retryable errors', () => {
            [
                google_gax_1.grpc.status.INVALID_ARGUMENT,
                google_gax_1.grpc.status.NOT_FOUND,
                google_gax_1.grpc.status.PERMISSION_DENIED,
                google_gax_1.grpc.status.FAILED_PRECONDITION,
                google_gax_1.grpc.status.OUT_OF_RANGE,
                google_gax_1.grpc.status.UNIMPLEMENTED,
            ].forEach((code) => {
                const shouldRetry = retrier.retry({ code });
                assert.strictEqual(shouldRetry, false);
            });
        });
        (0, mocha_1.it)('should reset the failure count on OK', () => {
            retrier.retry({ code: google_gax_1.grpc.status.CANCELLED });
            retrier.retry({ code: google_gax_1.grpc.status.OK });
            assert.strictEqual(retrier.createTimeout(), 0);
        });
        (0, mocha_1.it)('should reset the failure count on DEADLINE_EXCEEDED', () => {
            retrier.retry({ code: google_gax_1.grpc.status.CANCELLED });
            retrier.retry({ code: google_gax_1.grpc.status.DEADLINE_EXCEEDED });
            assert.strictEqual(retrier.createTimeout(), 0);
        });
    });
});
//# sourceMappingURL=pull-retry.js.map