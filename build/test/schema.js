"use strict";
// Copyright 2021 Google LLC
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
const sinon = require("sinon");
const protos_1 = require("../protos/protos");
const pubsub_1 = require("../src/pubsub");
const schema_1 = require("../src/schema");
const sandbox = sinon.createSandbox();
(0, mocha_1.describe)('Schema', () => {
    let pubsub;
    let schema;
    let schemaClient;
    const projectId = 'testProject';
    const projectName = `projects/${projectId}`;
    const schemaId = 'testSchema';
    const schemaName = `projects/${projectId}/schemas/${schemaId}`;
    const ischema = {
        name: schemaName,
        type: schema_1.SchemaTypes.Avro,
        definition: 'foo',
    };
    const encoding = protos_1.google.pubsub.v1.Encoding.JSON;
    (0, mocha_1.beforeEach)(async () => {
        pubsub = new pubsub_1.PubSub({
            projectId: 'testProject',
        });
        sandbox.stub(pubsub, 'getClientConfig').callsFake(async () => {
            pubsub.projectId = projectId;
            pubsub.name = projectName;
            return {};
        });
        // These depend on the create-on-first-call structure in PubSub.
        // If that changes, this will also need to be updated.
        schemaClient = await pubsub.getSchemaClient_();
        schema = pubsub.schema(schemaName);
    });
    (0, mocha_1.afterEach)(async () => {
        // Sadly I think it's not worthwhile to get this full pipeline
        // to work for unit tests - the plan is to test the autoclose in
        // the system tests.
        //
        // await pubsub.close();
        // Private member access:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // assert.strictEqual((schemaClient as any)._terminated, true);
        sandbox.reset();
    });
    (0, mocha_1.it)('properly sets its id', () => {
        assert.strictEqual(schema.id, schemaId);
    });
    (0, mocha_1.it)('properly sets its name', async () => {
        const name = await schema.getName();
        assert.strictEqual(name, schemaName);
    });
    (0, mocha_1.it)('calls PubSub.createSchema() when create() is called', async () => {
        let called = false;
        sandbox
            .stub(pubsub, 'createSchema')
            .callsFake(async (name, type, def, gaxOpts) => {
            assert.strictEqual(name, schemaName);
            assert.strictEqual(type, schema_1.SchemaTypes.Avro);
            assert.strictEqual(def, 'definition');
            assert.ok(gaxOpts);
            called = true;
            return new schema_1.Schema(pubsub, name);
        });
        await schema.create(schema_1.SchemaTypes.Avro, 'definition', {});
        assert.ok(called);
    });
    (0, mocha_1.it)('calls getSchema() on the client when get() is called', async () => {
        let called = false;
        sandbox
            .stub(schemaClient, 'getSchema')
            .callsFake(async (params, gaxOpts) => {
            const name = await schema.getName();
            assert.strictEqual(params.name, name);
            assert.strictEqual(params.view, 'FULL');
            assert.deepStrictEqual(gaxOpts, {});
            called = true;
            return [ischema];
        });
        const result = await schema.get(schema_1.SchemaViews.Full, {});
        assert.ok(called);
        assert.strictEqual(result.name, schemaName);
        assert.strictEqual(result.type, schema_1.SchemaTypes.Avro);
        assert.strictEqual(result.definition, 'foo');
    });
    (0, mocha_1.it)('defaults to FULL when get() is called', async () => {
        let called = false;
        sandbox.stub(schemaClient, 'getSchema').callsFake(async (params) => {
            assert.strictEqual(params.view, 'FULL');
            called = true;
            return [ischema];
        });
        await schema.get();
        assert.ok(called);
    });
    (0, mocha_1.it)('calls deleteSchema() on the client when delete() is called', async () => {
        let called = false;
        sandbox
            .stub(schemaClient, 'deleteSchema')
            .callsFake(async (params, gaxOpts) => {
            assert.strictEqual(params.name, schemaName);
            assert.ok(gaxOpts);
            called = true;
        });
        await schema.delete({});
        assert.ok(called);
    });
    (0, mocha_1.it)('calls validateMessage() on the client when validateMessage() is called on the wrapper', async () => {
        let called = false;
        sandbox
            .stub(schemaClient, 'validateMessage')
            .callsFake(async (params, gaxOpts) => {
            const name = await schema.getName();
            assert.strictEqual(params.parent, pubsub.name);
            assert.strictEqual(params.name, name);
            assert.strictEqual(params.schema, undefined);
            assert.strictEqual(params.message, 'foo');
            assert.strictEqual(params.encoding, encoding);
            assert.ok(gaxOpts);
            called = true;
        });
        await schema.validateMessage('foo', encoding, {});
        assert.ok(called);
    });
    (0, mocha_1.it)('resolves a missing project ID', async () => {
        pubsub = new pubsub_1.PubSub();
        schema = pubsub.schema(schemaId);
        assert.strictEqual(pubsub.isIdResolved, false);
        assert.strictEqual(schema.name_, undefined);
        sandbox.stub(pubsub, 'getClientConfig').callsFake(async () => {
            pubsub.projectId = projectId;
            pubsub.name = projectName;
            return {};
        });
        const name = await schema.getName();
        assert.strictEqual(pubsub.isIdResolved, true);
        assert.strictEqual(name, schemaName);
    });
    (0, mocha_1.it)('loads metadata from a received message', () => {
        const testAttrs = {
            googclient_schemaencoding: 'JSON',
            googclient_schemaname: 'foobar',
        };
        const metadata = schema_1.Schema.metadataFromMessage(testAttrs);
        assert.deepStrictEqual(metadata, {
            name: 'foobar',
            encoding: 'JSON',
        });
    });
});
//# sourceMappingURL=schema.js.map