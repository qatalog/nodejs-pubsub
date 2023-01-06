"use strict";
/*!
 * Copyright 2021 Google LLC
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
const sinon = require("sinon");
const defer = require("p-defer");
const publisher_1 = require("../../src/publisher");
const flow_control_1 = require("../../src/publisher/flow-control");
const fp = require("../../src/publisher/flow-publisher");
class FakePublisher {
    publishMessage() { }
    setOptions(options) {
        this.flowControl.setOptions(options.flowControlOptions);
    }
}
(0, mocha_1.describe)('Flow control publisher', () => {
    let publisher;
    const sandbox = sinon.createSandbox();
    (0, mocha_1.beforeEach)(() => {
        publisher = new FakePublisher();
        publisher.flowControl = new flow_control_1.FlowControl(publisher_1.flowControlDefaults);
    });
    (0, mocha_1.afterEach)(() => {
        sandbox.restore();
    });
    (0, mocha_1.it)('should get no promise if there is flow control space left', async () => {
        publisher.setOptions({
            flowControlOptions: {
                maxOutstandingMessages: 1,
            },
        });
        const addStub = sandbox.stub(publisher, 'publishMessage').resolves('');
        const fcp = new fp.FlowControlledPublisher(publisher);
        const publishResult = fcp.publish({ data: Buffer.from('foo') });
        assert.strictEqual(addStub.called, true);
        assert.strictEqual(publishResult, null);
    });
    (0, mocha_1.it)('should get a promise when there is no flow control space left', async () => {
        publisher.setOptions({
            flowControlOptions: {
                maxOutstandingMessages: 1,
            },
        });
        const deferred = defer();
        const addStub = sandbox
            .stub(publisher, 'publishMessage')
            .returns(deferred.promise);
        const fcp = new fp.FlowControlledPublisher(publisher);
        const firstResult = fcp.publish({ data: Buffer.from('foo') });
        assert.strictEqual(addStub.calledOnce, true);
        assert.strictEqual(firstResult, null);
        const secondResult = fcp.publish({ data: Buffer.from('bar') });
        assert.ok(secondResult);
        assert.strictEqual(addStub.calledOnce, true);
        publisher.flowControl.sent(3, 1);
        await secondResult;
        assert.strictEqual(addStub.calledTwice, true);
    });
    (0, mocha_1.it)('should still call sent() on send errors', async () => {
        const pubStub = sandbox.stub(publisher, 'publishMessage').rejects();
        const sentStub = sandbox.stub(publisher.flowControl, 'sent');
        const fcp = new fp.FlowControlledPublisher(publisher);
        await fcp.publish({ data: Buffer.from('foo') });
        assert.strictEqual(pubStub.called, true);
        assert.strictEqual(sentStub.called, true);
    });
    (0, mocha_1.it)('should send messages immediately when publishNow is called', () => {
        const pubStub = sandbox.stub(publisher, 'publishMessage').resolves('');
        const addStub = sandbox.stub(publisher.flowControl, 'addToCount');
        const fcp = new fp.FlowControlledPublisher(publisher);
        fcp.publishNow({ data: Buffer.from('foo') });
        assert.strictEqual(pubStub.calledOnce, true);
        assert.deepStrictEqual(addStub.args[0], [3, 1]);
    });
    (0, mocha_1.it)('should calculate the message size if needed, in wait mode', async () => {
        sandbox.stub(publisher, 'publishMessage').resolves();
        const fcp = new fp.FlowControlledPublisher(publisher);
        const message = { data: Buffer.from('test!') };
        await fcp.publish(message);
        assert.strictEqual(message.calculatedSize, 5);
    });
    (0, mocha_1.it)('should calculate the message size if needed, in now mode', () => {
        sandbox.stub(publisher, 'publishMessage').resolves();
        const fcp = new fp.FlowControlledPublisher(publisher);
        const message = { data: Buffer.from('test!') };
        fcp.publishNow(message);
        assert.strictEqual(message.calculatedSize, 5);
    });
});
//# sourceMappingURL=flow-publisher.js.map