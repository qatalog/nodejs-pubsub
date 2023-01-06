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
const crypto_1 = require("crypto");
const sinon = require("sinon");
const message_batch_1 = require("../../src/publisher/message-batch");
(0, mocha_1.describe)('MessageBatch', () => {
    let batch;
    const sandbox = sinon.createSandbox();
    const options = {
        maxBytes: 1000,
        maxMessages: 100,
    };
    (0, mocha_1.beforeEach)(() => {
        batch = new message_batch_1.MessageBatch(Object.assign({}, options));
    });
    (0, mocha_1.afterEach)(() => {
        sandbox.restore();
    });
    (0, mocha_1.describe)('initialization', () => {
        (0, mocha_1.it)('should localize options', () => {
            assert.deepStrictEqual(batch.options, options);
        });
        (0, mocha_1.it)('should create a message array', () => {
            assert.deepStrictEqual(batch.messages, []);
        });
        (0, mocha_1.it)('should create a callback array', () => {
            assert.deepStrictEqual(batch.callbacks, []);
        });
        (0, mocha_1.it)('should capture the creation time', () => {
            const now = Date.now();
            sandbox.stub(Date, 'now').returns(now);
            batch = new message_batch_1.MessageBatch(options);
            assert.strictEqual(batch.created, now);
        });
        (0, mocha_1.it)('should initialize bytes to 0', () => {
            assert.strictEqual(batch.bytes, 0);
        });
    });
    (0, mocha_1.describe)('add', () => {
        const callback = sandbox.spy();
        let message;
        let messageSize;
        (0, mocha_1.beforeEach)(() => {
            message = {
                data: Buffer.from('Hello, world!'),
            };
            messageSize = message.data.length;
        });
        (0, mocha_1.it)('should add the message to the message array', () => {
            batch.add(message, callback);
            assert.deepStrictEqual(batch.messages, [message]);
        });
        (0, mocha_1.it)('should add the callback to the callback array', () => {
            batch.add(message, callback);
            assert.deepStrictEqual(batch.callbacks, [callback]);
        });
        (0, mocha_1.it)('should adjust the byte count', () => {
            batch.add(message, callback);
            assert.strictEqual(batch.bytes, messageSize);
        });
    });
    (0, mocha_1.describe)('canFit', () => {
        let message;
        let messageSize;
        (0, mocha_1.beforeEach)(() => {
            message = {
                data: Buffer.from('Hello, world!'),
            };
            messageSize = message.data.length;
        });
        (0, mocha_1.it)('should return false if too many messages', () => {
            batch.options.maxMessages = 0;
            const canFit = batch.canFit(message);
            assert.strictEqual(canFit, false);
        });
        (0, mocha_1.it)('should return false if too many bytes', () => {
            batch.options.maxBytes = messageSize - 1;
            const canFit = batch.canFit(message);
            assert.strictEqual(canFit, false);
        });
        (0, mocha_1.it)('should return true if it can fit', () => {
            const canFit = batch.canFit(message);
            assert.strictEqual(canFit, true);
        });
    });
    (0, mocha_1.describe)('isAtMax', () => {
        (0, mocha_1.it)('should return true if at max message limit', () => {
            // tslint:disable-next-line ban
            Array(1000)
                .fill({
                data: Buffer.from('Hello!'),
            })
                .forEach(message => {
                batch.add(message, sandbox.spy());
            });
            const isAtMax = batch.isAtMax();
            assert.strictEqual(isAtMax, true);
        });
        (0, mocha_1.it)('should return true if at max byte limit', () => {
            const message = {
                data: (0, crypto_1.randomBytes)(Math.pow(1024, 2) * 9),
            };
            batch.add(message, sandbox.spy());
            const isAtMax = batch.isAtMax();
            assert.strictEqual(isAtMax, true);
        });
        (0, mocha_1.it)('should return false if it is not full', () => {
            const message = {
                data: (0, crypto_1.randomBytes)(500),
            };
            batch.add(message, sandbox.spy());
            const isAtMax = batch.isAtMax();
            assert.strictEqual(isAtMax, false);
        });
    });
    (0, mocha_1.describe)('isFull', () => {
        let message;
        let messageSize;
        (0, mocha_1.beforeEach)(() => {
            message = {
                data: Buffer.from('Hello, world!'),
            };
            messageSize = message.data.length;
        });
        (0, mocha_1.it)('should return true if at max message limit', () => {
            batch.options.maxMessages = 1;
            batch.add(message, sandbox.spy());
            const isFull = batch.isFull();
            assert.strictEqual(isFull, true);
        });
        (0, mocha_1.it)('should return true if at max byte limit', () => {
            batch.options.maxBytes = messageSize;
            batch.add(message, sandbox.spy());
            const isFull = batch.isFull();
            assert.strictEqual(isFull, true);
        });
        (0, mocha_1.it)('should return false if it is not full', () => {
            batch.add(message, sandbox.spy());
            const isFull = batch.isFull();
            assert.strictEqual(isFull, false);
        });
    });
    (0, mocha_1.describe)('setOptions', () => {
        (0, mocha_1.it)('updates the options', () => {
            const newOptions = {};
            batch.setOptions(newOptions);
            assert.strictEqual(newOptions, batch.options);
        });
    });
});
//# sourceMappingURL=message-batch.js.map