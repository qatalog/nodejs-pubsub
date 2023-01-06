"use strict";
// Copyright 2022 Google LLC
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
const mocha_1 = require("mocha");
const assert = require("assert");
const sinon = require("sinon");
const exponential_retry_1 = require("../src/exponential-retry");
const temporal_1 = require("../src/temporal");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function introspect(obj) {
    return obj;
}
function makeItem() {
    return {
        foo: 'an item',
    };
}
(0, mocha_1.describe)('exponential retry class', () => {
    const sandbox = sinon.createSandbox();
    afterEach(() => sandbox.restore());
    (0, mocha_1.it)('initializes correctly', () => {
        // This one is honestly not terribly interesting except that the
        // class is storing the durations as numbers internally.
        const er = new exponential_retry_1.ExponentialRetry(temporal_1.Duration.from({ seconds: 1 }), temporal_1.Duration.from({ seconds: 2 }));
        const eri = introspect(er);
        assert.strictEqual(eri._backoffMs, 1000);
        assert.strictEqual(eri._maxBackoffMs, 2000);
    });
    (0, mocha_1.it)('makes the first callback', () => {
        const clock = sandbox.useFakeTimers();
        const er = new exponential_retry_1.ExponentialRetry(temporal_1.Duration.from({ millis: 100 }), temporal_1.Duration.from({ millis: 1000 }));
        sandbox.stub(global.Math, 'random').returns(0.75);
        const item = makeItem();
        er.retryLater(item, (s, t) => {
            assert.strictEqual(s, item);
            assert.strictEqual(t.totalOf('millisecond'), 125);
        });
        clock.tick(125);
        const leftovers = er.close();
        assert.strictEqual(leftovers.length, 0);
    });
    (0, mocha_1.it)('closes gracefully', () => {
        const clock = sandbox.useFakeTimers();
        const er = new exponential_retry_1.ExponentialRetry(temporal_1.Duration.from({ millis: 100 }), temporal_1.Duration.from({ millis: 1000 }));
        sandbox.stub(global.Math, 'random').returns(0.75);
        let called = false;
        const item = makeItem();
        er.retryLater(item, (s, t) => {
            assert.strictEqual(s, item);
            assert.strictEqual(t.totalOf('millisecond'), 125);
            called = true;
        });
        clock.tick(5);
        const leftovers = er.close();
        clock.tick(125);
        assert.strictEqual(called, false);
        const eri = introspect(er);
        assert.strictEqual(eri._items.isEmpty(), true);
        assert.strictEqual(leftovers.length, 1);
    });
    (0, mocha_1.it)('backs off exponentially', () => {
        const clock = sandbox.useFakeTimers();
        const er = new exponential_retry_1.ExponentialRetry(temporal_1.Duration.from({ millis: 100 }), temporal_1.Duration.from({ millis: 1000 }));
        sandbox.stub(global.Math, 'random').returns(0.75);
        let callbackCount = 0;
        let callbackTime = temporal_1.Duration.from({ millis: 0 });
        const item = makeItem();
        const callback = (s, t) => {
            assert.strictEqual(s, item);
            callbackTime = t;
            callbackCount++;
            if (callbackCount === 1) {
                er.retryLater(item, callback);
            }
        };
        er.retryLater(item, callback);
        clock.tick(125);
        assert.strictEqual(callbackCount, 1);
        assert.strictEqual(callbackTime.totalOf('millisecond'), 125);
        clock.tick(400);
        assert.strictEqual(callbackCount, 2);
        assert.strictEqual(callbackTime.totalOf('millisecond'), 375);
        const leftovers = er.close();
        assert.strictEqual(leftovers.length, 0);
    });
    (0, mocha_1.it)('backs off exponentially until the max backoff', () => {
        const clock = sandbox.useFakeTimers();
        const item = makeItem();
        const er = new exponential_retry_1.ExponentialRetry(temporal_1.Duration.from({ millis: 100 }), temporal_1.Duration.from({ millis: 150 }));
        sandbox.stub(global.Math, 'random').returns(0.75);
        let callbackCount = 0;
        let callbackTime = temporal_1.Duration.from({ millis: 0 });
        const callback = (s, t) => {
            assert.strictEqual(s, item);
            callbackTime = t;
            callbackCount++;
            if (callbackCount === 1) {
                er.retryLater(item, callback);
            }
        };
        er.retryLater(item, callback);
        clock.tick(125);
        assert.strictEqual(callbackCount, 1);
        assert.strictEqual(callbackTime.totalOf('millisecond'), 125);
        clock.tick(400);
        assert.strictEqual(callbackCount, 2);
        assert.strictEqual(callbackTime.totalOf('millisecond'), 312);
        const leftovers = er.close();
        assert.strictEqual(leftovers.length, 0);
    });
    (0, mocha_1.it)('calls retries in the right order', () => {
        const clock = sandbox.useFakeTimers();
        const items = [makeItem(), makeItem()];
        const er = new exponential_retry_1.ExponentialRetry(temporal_1.Duration.from({ millis: 100 }), temporal_1.Duration.from({ millis: 1000 }));
        // Just disable the fuzz for this test.
        sandbox.stub(global.Math, 'random').returns(0.5);
        const callbackCounts = [0, 0];
        const callbackTimes = [
            temporal_1.Duration.from({ millis: 0 }),
            temporal_1.Duration.from({ millis: 0 }),
        ];
        const callback = (s, t) => {
            const idx = s === items[0] ? 0 : 1;
            callbackCounts[idx]++;
            callbackTimes[idx] = t;
            if (callbackCounts[idx] < 2) {
                er.retryLater(items[idx], callback);
            }
        };
        // Load in the first item and get it retrying.
        er.retryLater(items[0], callback);
        clock.tick(300);
        assert.deepStrictEqual(callbackCounts, [2, 0]);
        assert.deepStrictEqual(callbackTimes.map(d => d.totalOf('millisecond')), [300, 0]);
        // Load in the second item and get it retrying.
        er.retryLater(items[1], callback);
        clock.tick(125);
        // The first item should've retried twice and still be in the queue,
        // while the second item should've retried once and quit.
        assert.deepStrictEqual(callbackCounts, [2, 1]);
        assert.deepStrictEqual(callbackTimes.map(d => d.totalOf('millisecond')), [300, 100]);
        // Make sure that we did in fact set another timer for the next event.
        const eri = introspect(er);
        assert.ok(eri._timer);
        const leftovers = er.close();
        assert.strictEqual(leftovers.length, 1);
    });
});
//# sourceMappingURL=exponential-retry.js.map