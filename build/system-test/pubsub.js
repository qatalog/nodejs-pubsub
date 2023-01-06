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
const crypto = require("crypto");
const defer = require("p-defer");
const uuid = require("uuid");
// This is only in Node 10.17+, but it's used for system tests, should be okay.
// eslint-disable-next-line node/no-unsupported-features/node-builtins
const fs_1 = require("fs");
const src_1 = require("../src");
const PREFIX = 'gcloud-tests';
const CURRENT_TIME = Date.now();
const pubsub = new src_1.PubSub();
function shortUUID() {
    return uuid.v1().split('-').shift();
}
(0, mocha_1.describe)('pubsub', () => {
    const TOPIC_NAMES = [
        generateTopicName(),
        generateTopicName(),
        generateTopicName(),
    ];
    const TOPICS = [
        pubsub.topic(TOPIC_NAMES[0]),
        pubsub.topic(TOPIC_NAMES[1]),
        pubsub.topic(TOPIC_NAMES[2]),
    ];
    const TOPIC_FULL_NAMES = TOPICS.map(getTopicName);
    function generateName(name) {
        return [PREFIX, name, shortUUID(), CURRENT_TIME].join('-');
    }
    function generateSnapshotName() {
        return generateName('snapshot');
    }
    function generateSubName() {
        return generateName('subscription');
    }
    function generateSchemaName() {
        return generateName('schema');
    }
    function generateSubForDetach() {
        return generateSubName();
    }
    function generateTopicName() {
        return generateName('topic');
    }
    function getTopicName(topic) {
        return topic.name.split('/').pop();
    }
    function deleteTestResource(resource) {
        // Delete resource from current test run.
        if (resource.name.includes(CURRENT_TIME.toString())) {
            resource.delete();
            return;
        }
        // Delete left over resources which is older then 1 hour.
        if (!resource.name.includes(PREFIX)) {
            return;
        }
        const createdAt = Number(resource.name.split('-').pop());
        const timeDiff = (Date.now() - createdAt) / (1000 * 60 * 60);
        if (timeDiff > 1) {
            resource.delete();
        }
    }
    async function deleteTestResources() {
        const topicStream = pubsub.getTopicsStream().on('data', deleteTestResource);
        const subscriptionStream = pubsub
            .getSubscriptionsStream()
            .on('data', deleteTestResource);
        const snapshotStream = pubsub
            .getSnapshotsStream()
            .on('data', deleteTestResource);
        const streams = [topicStream, subscriptionStream, snapshotStream].map(stream => {
            return new Promise((resolve, reject) => {
                stream.on('error', reject);
                stream.on('end', resolve);
            });
        });
        return Promise.all(streams);
    }
    async function publishPop(message) {
        const topic = pubsub.topic(generateTopicName());
        const subscription = topic.subscription(generateSubName());
        await topic.create();
        await subscription.create();
        for (let i = 0; i < 6; i++) {
            await topic.publishMessage(message);
        }
        return new Promise((resolve, reject) => {
            subscription.on('error', reject);
            subscription.once('message', resolve);
        });
    }
    (0, mocha_1.before)(async () => {
        await deleteTestResources();
        // create all needed topics with metadata
        await Promise.all(TOPICS.map(t => t.create()));
    });
    (0, mocha_1.after)(() => {
        // Delete all created test resources
        return deleteTestResources();
    });
    (0, mocha_1.describe)('Topic', () => {
        (0, mocha_1.it)('should be listed', async () => {
            const [topics] = await pubsub.getTopics();
            const results = topics.filter(topic => {
                const name = getTopicName(topic);
                return TOPIC_FULL_NAMES.indexOf(name) !== -1;
            });
            // get all topics in list of known names
            assert.strictEqual(results.length, TOPIC_NAMES.length);
        });
        (0, mocha_1.it)('should list topics in a stream', done => {
            const topicsEmitted = new Array();
            pubsub
                .getTopicsStream()
                .on('error', done)
                .on('data', (topic) => {
                topicsEmitted.push(topic);
            })
                .on('end', () => {
                const results = topicsEmitted.filter(topic => {
                    const name = getTopicName(topic);
                    return TOPIC_FULL_NAMES.indexOf(name) !== -1;
                });
                assert.strictEqual(results.length, TOPIC_NAMES.length);
                done();
            });
        });
        (0, mocha_1.it)('should allow manual paging', async () => {
            const [topics] = await pubsub.getTopics({
                pageSize: TOPIC_NAMES.length - 1,
                gaxOpts: { autoPaginate: false },
            });
            assert.strictEqual(topics.length, TOPIC_NAMES.length - 1);
        });
        (0, mocha_1.it)('should be created and deleted', done => {
            const TOPIC_NAME = generateTopicName();
            pubsub.createTopic(TOPIC_NAME, err => {
                assert.ifError(err);
                pubsub.topic(TOPIC_NAME).delete(done);
            });
        });
        (0, mocha_1.it)('should honor the autoCreate option', done => {
            const topic = pubsub.topic(generateTopicName());
            topic.get({ autoCreate: true }, done);
        });
        (0, mocha_1.it)('should confirm if a topic exists', done => {
            const topic = pubsub.topic(TOPIC_NAMES[0]);
            topic.exists((err, exists) => {
                assert.ifError(err);
                assert.strictEqual(exists, true);
                done();
            });
        });
        (0, mocha_1.it)('should confirm if a topic does not exist', done => {
            const topic = pubsub.topic('should-not-exist');
            topic.exists((err, exists) => {
                assert.ifError(err);
                assert.strictEqual(exists, false);
                done();
            });
        });
        (0, mocha_1.it)('should publish a message', done => {
            const topic = pubsub.topic(TOPIC_NAMES[0]);
            const message = {
                data: Buffer.from('message from me'),
                orderingKey: 'a',
            };
            topic.publishMessage(message, (err, messageId) => {
                assert.ifError(err);
                assert.strictEqual(typeof messageId, 'string');
                done();
            });
        });
        (0, mocha_1.it)('should publish a message with attributes', async () => {
            const data = Buffer.from('raw message data');
            const attributes = {
                customAttribute: 'value',
            };
            const message = await publishPop({ data, attributes });
            assert.deepStrictEqual(message.data, data);
            assert.deepStrictEqual(message.attributes, attributes);
        });
        (0, mocha_1.it)('should get the metadata of a topic', done => {
            const topic = pubsub.topic(TOPIC_NAMES[0]);
            topic.getMetadata((err, metadata) => {
                assert.ifError(err);
                assert.strictEqual(metadata.name, topic.name);
                done();
            });
        });
        (0, mocha_1.describe)('ordered messages', () => {
            (0, mocha_1.it)('should pass the acceptance tests', async () => {
                const [topic] = await pubsub.createTopic(generateName('orderedtopic'));
                const [subscription] = await topic.createSubscription(generateName('orderedsub'), {
                    enableMessageOrdering: true,
                });
                const { input, expected,
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                 } = require('../../system-test/fixtures/ordered-messages.json');
                const publishes = input.map(({ key, message }) => {
                    const options = {
                        data: Buffer.from(message),
                    };
                    if (key) {
                        options.orderingKey = key;
                    }
                    return topic.publishMessage(options);
                });
                await Promise.all(publishes);
                const pending = {};
                expected.forEach(({ key, messages }) => {
                    pending[key] = messages;
                });
                const deferred = defer();
                subscription
                    .on('error', deferred.reject)
                    .on('message', (message) => {
                    const key = message.orderingKey || '';
                    const data = message.data.toString();
                    const messages = pending[key];
                    if (!messages) {
                        deferred.reject(new Error(`Unknown key "${key}" for test data: ${JSON.stringify(pending, null, 4)}`));
                        subscription.close();
                        return;
                    }
                    const expected = messages[0];
                    if (key && data !== expected) {
                        deferred.reject(new Error(`Expected "${expected}" but received "${data}" for key "${key}"`));
                        subscription.close();
                        return;
                    }
                    message.ack();
                    messages.splice(messages.indexOf(data), 1);
                    if (!pending[key].length)
                        delete pending[key];
                    if (!Object.keys(pending).length) {
                        deferred.resolve();
                    }
                });
                await deferred.promise;
                await Promise.all([topic.delete(), subscription.delete()]);
            });
        });
    });
    (0, mocha_1.describe)('Subscription', () => {
        const TOPIC_NAME = generateTopicName();
        const topic = pubsub.topic(TOPIC_NAME);
        const SUB_NAMES = [generateSubName(), generateSubName()];
        const SUB_DETACH_NAME = generateSubForDetach();
        const SUBSCRIPTIONS = [
            topic.subscription(SUB_NAMES[0], { ackDeadline: 30 }),
            topic.subscription(SUB_NAMES[1], { ackDeadline: 60 }),
            topic.subscription(SUB_DETACH_NAME, { ackDeadline: 30 }),
        ];
        (0, mocha_1.before)(async () => {
            await topic.create();
            await Promise.all(SUBSCRIPTIONS.map(s => s.create()));
            for (let i = 0; i < 10; i++) {
                const data = Buffer.from('hello');
                await topic.publishMessage({ data });
            }
            await new Promise(r => setTimeout(r, 2500));
        });
        (0, mocha_1.after)(() => {
            // Delete subscriptions
            return Promise.all(SUBSCRIPTIONS.map(async (s) => {
                try {
                    await s.delete();
                }
                catch (e) {
                    await topic.delete();
                }
            }));
        });
        (0, mocha_1.it)('should return error if creating an existing subscription', done => {
            // Use a new topic name...
            const topic = pubsub.topic(generateTopicName());
            // ...but with the same subscription name that we already created...
            const subscription = topic.subscription(SUB_NAMES[0]);
            subscription.create(err => {
                if (!err) {
                    assert.fail('Should not have created subscription successfully.');
                }
                // ...and it should fail, because the subscription name is unique to the
                // project, and not the topic.
                assert.strictEqual(err.code, 6);
                done();
            });
        });
        (0, mocha_1.it)('should list all subscriptions registered to the topic', done => {
            topic.getSubscriptions((err, subs) => {
                assert.ifError(err);
                assert.strictEqual(subs.length, SUBSCRIPTIONS.length);
                assert(subs[0] instanceof src_1.Subscription);
                done();
            });
        });
        (0, mocha_1.it)('should list all topic subscriptions as a stream', done => {
            const subscriptionsEmitted = [];
            topic
                .getSubscriptionsStream()
                .on('error', done)
                .on('data', (subscription) => {
                subscriptionsEmitted.push(subscription);
            })
                .on('end', () => {
                assert.strictEqual(subscriptionsEmitted.length, SUBSCRIPTIONS.length);
                done();
            });
        });
        (0, mocha_1.it)('should list all subscriptions regardless of topic', done => {
            pubsub.getSubscriptions((err, subscriptions) => {
                assert.ifError(err);
                assert(subscriptions instanceof Array);
                done();
            });
        });
        (0, mocha_1.it)('should list all subscriptions as a stream', done => {
            let subscriptionEmitted = false;
            pubsub
                .getSubscriptionsStream()
                .on('error', done)
                .on('data', (subscription) => {
                subscriptionEmitted = subscription instanceof src_1.Subscription;
            })
                .on('end', () => {
                assert.strictEqual(subscriptionEmitted, true);
                done();
            });
        });
        (0, mocha_1.it)('should allow creation and deletion of a subscription', done => {
            const subName = generateSubName();
            topic.createSubscription(subName, (err, sub) => {
                assert.ifError(err);
                assert(sub instanceof src_1.Subscription);
                sub.delete(done);
            });
        });
        (0, mocha_1.it)('should honor the autoCreate option', done => {
            const sub = topic.subscription(generateSubName());
            sub.get({ autoCreate: true }, done);
        });
        (0, mocha_1.it)('should confirm if a sub exists', done => {
            const sub = topic.subscription(SUB_NAMES[0]);
            sub.exists((err, exists) => {
                assert.ifError(err);
                assert.strictEqual(exists, true);
                done();
            });
        });
        (0, mocha_1.it)('should confirm if a sub does not exist', done => {
            const sub = topic.subscription('should-not-exist');
            sub.exists((err, exists) => {
                assert.ifError(err);
                assert.strictEqual(exists, false);
                done();
            });
        });
        (0, mocha_1.it)('should create a subscription with message retention', done => {
            const subName = generateSubName();
            const threeDaysInSeconds = 3 * 24 * 60 * 60;
            const callOptions = {
                messageRetentionDuration: threeDaysInSeconds,
                topic: '',
                name: '',
            };
            topic.createSubscription(subName, callOptions, (err, sub) => {
                assert.ifError(err);
                sub.getMetadata((err, metadata) => {
                    assert.ifError(err);
                    assert.strictEqual(Number(metadata.messageRetentionDuration.seconds), threeDaysInSeconds);
                    assert.strictEqual(Number(metadata.messageRetentionDuration.nanos), 0);
                    sub.delete(done);
                });
            });
        });
        (0, mocha_1.it)('should set metadata for a subscription', () => {
            const subscription = topic.subscription(generateSubName());
            const threeDaysInSeconds = 3 * 24 * 60 * 60;
            return subscription
                .create()
                .then(() => {
                return subscription.setMetadata({
                    messageRetentionDuration: threeDaysInSeconds,
                });
            })
                .then(() => {
                return subscription.getMetadata();
            })
                .then(([metadata]) => {
                const { seconds, nanos } = metadata.messageRetentionDuration;
                assert.strictEqual(Number(seconds), threeDaysInSeconds);
                assert.strictEqual(Number(nanos), 0);
            });
        });
        (0, mocha_1.it)('should error when using a non-existent subscription', done => {
            const subscription = topic.subscription(generateSubName());
            subscription.on('error', (err) => {
                assert.strictEqual(err.code, 5);
                subscription.close(done);
            });
            subscription.on('message', () => {
                done(new Error('Should not have been called.'));
            });
        });
        (0, mocha_1.it)('should receive the published messages', done => {
            let messageCount = 0;
            const subscription = topic.subscription(SUB_NAMES[1]);
            subscription.on('error', done);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            subscription.on('message', (message) => {
                assert.deepStrictEqual(message.data, Buffer.from('hello'));
                if (++messageCount === 10) {
                    subscription.close(done);
                }
            });
        });
        (0, mocha_1.it)('should ack the message', done => {
            const subscription = topic.subscription(SUB_NAMES[1]);
            let finished = false;
            subscription.on('error', () => {
                if (!finished) {
                    finished = true;
                    subscription.close(done);
                }
            });
            subscription.on('message', ack);
            function ack(message) {
                if (!finished) {
                    finished = true;
                    message.ack();
                    subscription.close(done);
                }
            }
        });
        (0, mocha_1.it)('should nack the message', done => {
            const subscription = topic.subscription(SUB_NAMES[1]);
            let finished = false;
            subscription.on('error', () => {
                if (!finished) {
                    finished = true;
                    subscription.close(done);
                }
            });
            subscription.on('message', nack);
            function nack(message) {
                if (!finished) {
                    finished = true;
                    message.nack();
                    subscription.close(done);
                }
            }
        });
        (0, mocha_1.it)('should respect flow control limits', done => {
            const maxMessages = 3;
            let messageCount = 0;
            const subscription = topic.subscription(SUB_NAMES[0], {
                flowControl: { maxMessages, allowExcessMessages: false },
            });
            subscription.on('error', done);
            subscription.on('message', onMessage);
            function onMessage() {
                if (++messageCount < maxMessages) {
                    return;
                }
                subscription.close(done);
            }
        });
        (0, mocha_1.it)('should send and receive large messages', done => {
            const subscription = topic.subscription(SUB_NAMES[0]);
            const data = crypto.randomBytes(9000000); // 9mb
            topic.publishMessage({ data }, (err, messageId) => {
                assert.ifError(err);
                subscription.on('error', done).on('message', (message) => {
                    if (message.id !== messageId) {
                        return;
                    }
                    assert.deepStrictEqual(data, message.data);
                    subscription.close(done);
                });
            });
        });
        (0, mocha_1.it)('should detach subscriptions', async () => {
            const subscription = topic.subscription(SUB_DETACH_NAME);
            const [before] = await subscription.detached();
            assert.strictEqual(before, false);
            await pubsub.detachSubscription(SUB_DETACH_NAME);
            const [after] = await subscription.detached();
            assert.strictEqual(after, true);
        });
        // can be ran manually to test options/memory usage/etc.
        // tslint:disable-next-line ban
        mocha_1.it.skip('should handle a large volume of messages', async function () {
            const MESSAGES = 200000;
            const deferred = defer();
            const messages = new Set();
            let duplicates = 0;
            this.timeout(0);
            const subscription = topic.subscription(SUB_NAMES[0]);
            topic.setPublishOptions({ batching: { maxMessages: 999 } });
            await publish(MESSAGES);
            const startTime = Date.now();
            subscription.on('error', deferred.reject).on('message', onmessage);
            return deferred.promise;
            function onmessage(message) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const testid = message.attributes.testid;
                if (!testid) {
                    return;
                }
                message.ack();
                if (messages.has(testid)) {
                    messages.delete(testid);
                }
                else {
                    duplicates += 1;
                }
                if (messages.size > 0) {
                    return;
                }
                const total = MESSAGES + duplicates;
                const duration = (Date.now() - startTime) / 1000 / 60;
                const acksPerMin = Math.floor(total / duration);
                console.log(`${total} messages processed.`);
                console.log(`${duplicates} messages redelivered.`);
                console.log(`${acksPerMin} acks/m on average.`);
                subscription.close((err) => {
                    if (err) {
                        deferred.reject(err);
                    }
                    else {
                        deferred.resolve();
                    }
                });
            }
            function publish(messageCount) {
                const data = Buffer.from('Hello, world!');
                const promises = [];
                let id = 0;
                for (let i = 0; i < messageCount; i++) {
                    const testid = String(++id);
                    const attributes = { testid };
                    messages.add(testid);
                    promises.push(topic.publishMessage({ data, attributes }));
                }
                return Promise.all(promises);
            }
        });
    });
    (0, mocha_1.describe)('IAM', () => {
        (0, mocha_1.it)('should get a policy', done => {
            const topic = pubsub.topic(TOPIC_NAMES[0]);
            topic.iam.getPolicy((err, policy) => {
                assert.ifError(err);
                assert.deepStrictEqual(policy.bindings, []);
                assert.strictEqual(policy.version, 0);
                done();
            });
        });
        (0, mocha_1.it)('should set a policy', done => {
            const topic = pubsub.topic(TOPIC_NAMES[0]);
            const policy = {
                bindings: [
                    {
                        role: 'roles/pubsub.publisher',
                        members: [
                            'serviceAccount:gmail-api-push@system.gserviceaccount.com',
                        ],
                    },
                ],
            };
            topic.iam.setPolicy(policy, (err, newPolicy) => {
                assert.ifError(err);
                const expectedBindings = policy.bindings.map(binding => Object.assign({ condition: null }, binding));
                assert.deepStrictEqual(newPolicy.bindings, expectedBindings);
                done();
            });
        });
        (0, mocha_1.it)('should test the iam permissions', done => {
            const topic = pubsub.topic(TOPIC_NAMES[0]);
            const testPermissions = ['pubsub.topics.get', 'pubsub.topics.update'];
            topic.iam.testPermissions(testPermissions, (err, permissions) => {
                assert.ifError(err);
                assert.deepStrictEqual(permissions, {
                    'pubsub.topics.get': true,
                    'pubsub.topics.update': true,
                });
                done();
            });
        });
    });
    (0, mocha_1.describe)('Snapshot', () => {
        const SNAPSHOT_NAME = generateSnapshotName();
        let topic;
        let subscription;
        let snapshot;
        function getSnapshotName({ name }) {
            return name.split('/').pop();
        }
        (0, mocha_1.before)(async () => {
            topic = pubsub.topic(generateTopicName());
            subscription = topic.subscription(generateSubName());
            snapshot = subscription.snapshot(SNAPSHOT_NAME);
            await topic.create();
            await subscription.create();
            await snapshot.create();
        });
        (0, mocha_1.after)(async () => {
            await snapshot.delete();
            await subscription.delete();
            await topic.delete();
        });
        (0, mocha_1.it)('should get a list of snapshots', done => {
            pubsub.getSnapshots((err, snapshots) => {
                assert.ifError(err);
                assert(snapshots.length > 0);
                const names = snapshots.map(getSnapshotName);
                assert(names.includes(SNAPSHOT_NAME));
                done();
            });
        });
        (0, mocha_1.it)('should get a list of snapshots as a stream', done => {
            const snapshots = new Array();
            pubsub
                .getSnapshotsStream()
                .on('error', done)
                .on('data', (snapshot) => snapshots.push(snapshot))
                .on('end', () => {
                assert(snapshots.length > 0);
                const names = snapshots.map(getSnapshotName);
                assert(names.includes(SNAPSHOT_NAME));
                done();
            });
        });
        (0, mocha_1.describe)('seeking', () => {
            let subscription;
            let snapshot;
            let messageId;
            let errorPromise;
            (0, mocha_1.beforeEach)(async () => {
                subscription = topic.subscription(generateSubName());
                snapshot = subscription.snapshot(generateSnapshotName());
                await subscription.create();
                await snapshot.create();
                errorPromise = new Promise((_, reject) => subscription.on('error', reject));
            });
            function makeMessagePromise(workCallback) {
                return new Promise(resolve => {
                    subscription.on('message', (arg) => {
                        workCallback(arg, resolve);
                    });
                });
            }
            async function publishTestMessage() {
                messageId = await topic.publish(Buffer.from('Hello, world!'));
            }
            (0, mocha_1.it)('should seek to a snapshot', async () => {
                let messageCount = 0;
                const messagePromise = makeMessagePromise(async (message, resolve) => {
                    if (message.id !== messageId) {
                        return;
                    }
                    message.ack();
                    if (++messageCount === 1) {
                        await snapshot.seek();
                        return;
                    }
                    assert.strictEqual(messageCount, 2);
                    await subscription.close();
                    resolve();
                });
                await publishTestMessage();
                await Promise.race([errorPromise, messagePromise]);
            });
            (0, mocha_1.it)('should seek to a date', async () => {
                let messageCount = 0;
                const messagePromise = makeMessagePromise(async (message, resolve) => {
                    if (message.id !== messageId) {
                        return;
                    }
                    message.ack();
                    if (++messageCount === 1) {
                        subscription.seek(message.publishTime, (err) => {
                            assert.ifError(err);
                        });
                        return;
                    }
                    assert.strictEqual(messageCount, 2);
                    await subscription.close();
                    resolve();
                });
                await publishTestMessage();
                await Promise.race([errorPromise, messagePromise]);
            });
            (0, mocha_1.it)('should seek to a future date (purge)', async () => {
                const testText = 'Oh no!';
                await publishTestMessage();
                // Forward-seek to remove any messages from the queue (those were
                // placed there in before()).
                //
                // We... probably won't be using this in 3000?
                await subscription.seek(new Date('3000-01-01'));
                // Drop a second message and make sure it's the right ID.
                await topic.publish(Buffer.from(testText));
                const messagePromise = makeMessagePromise(async (message, resolve) => {
                    // If we get the default message from before() then this fails.
                    assert.equal(message.data.toString(), testText);
                    message.ack();
                    await subscription.close();
                    resolve();
                });
                await Promise.race([errorPromise, messagePromise]);
            });
        });
    });
    (0, mocha_1.describe)('schema', () => {
        // This should really be handled by a standard method of Array(), imo, but it's not.
        async function aiToArray(iterator, nameFilter) {
            var _a;
            const result = [];
            for await (const i of iterator) {
                if (!nameFilter || (nameFilter && ((_a = i.name) === null || _a === void 0 ? void 0 : _a.endsWith(nameFilter)))) {
                    result.push(i);
                }
            }
            return result;
        }
        const getSchemaDef = async () => {
            const schemaDef = (await fs_1.promises.readFile('system-test/fixtures/provinces.avsc')).toString();
            return schemaDef;
        };
        const setupTestSchema = async () => {
            const schemaDef = await getSchemaDef();
            const schemaId = generateSchemaName();
            await pubsub.createSchema(schemaId, src_1.SchemaTypes.Avro, schemaDef);
            return schemaId;
        };
        (0, mocha_1.it)('should create a schema', async () => {
            const schemaId = await setupTestSchema();
            const schemaList = await aiToArray(pubsub.listSchemas(), schemaId);
            assert.strictEqual(schemaList.length, 1);
        });
        (0, mocha_1.it)('should delete a schema', async () => {
            const schemaId = await setupTestSchema();
            // Validate that we created one, because delete() doesn't throw, and we
            // might end up causing a false negative.
            const preSchemaList = await aiToArray(pubsub.listSchemas(), schemaId);
            assert.strictEqual(preSchemaList.length, 1);
            await pubsub.schema(schemaId).delete();
            const postSchemaList = await aiToArray(pubsub.listSchemas(), schemaId);
            assert.strictEqual(postSchemaList.length, 0);
        });
        (0, mocha_1.it)('should list schemas', async () => {
            const schemaId = await setupTestSchema();
            const basicList = await aiToArray(pubsub.listSchemas(src_1.SchemaViews.Basic), schemaId);
            assert.strictEqual(basicList.length, 1);
            assert.strictEqual(basicList[0].definition, '');
            const fullList = await aiToArray(pubsub.listSchemas(src_1.SchemaViews.Full), schemaId);
            assert.strictEqual(fullList.length, 1);
            assert.ok(fullList[0].definition);
        });
        (0, mocha_1.it)('should get a schema', async () => {
            const schemaId = await setupTestSchema();
            const schema = pubsub.schema(schemaId);
            const info = await schema.get(src_1.SchemaViews.Basic);
            assert.strictEqual(info.definition, '');
            const fullInfo = await schema.get(src_1.SchemaViews.Full);
            assert.ok(fullInfo.definition);
        });
        (0, mocha_1.it)('should validate a schema', async () => {
            const schemaDef = await getSchemaDef();
            try {
                await pubsub.validateSchema({
                    type: src_1.SchemaTypes.Avro,
                    definition: schemaDef,
                });
            }
            catch (e) {
                assert.strictEqual(e, undefined, 'Error thrown by validateSchema');
            }
            const badSchemaDef = '{"not_actually":"avro"}';
            try {
                await pubsub.validateSchema({
                    type: src_1.SchemaTypes.Avro,
                    definition: badSchemaDef,
                });
            }
            catch (e) {
                assert.ok(e);
            }
            const fakeSchemaDef = 'woohoo i am a schema, no really';
            try {
                await pubsub.validateSchema({
                    type: src_1.SchemaTypes.Avro,
                    definition: fakeSchemaDef,
                });
            }
            catch (e) {
                assert.ok(e);
            }
        });
        // The server doesn't seem to be returning proper responses for this.
        // Commenting out for now, until it can be discussed.
        // TODO(feywind): Uncomment this later. May be solved by b/188927641.
        /* it('should validate a message', async () => {
          const schemaId = await setupTestSchema();
          const schema = pubsub.schema(schemaId);
          const testMessage = (
            await fs.readFile('system-test/fixtures/province.json')
          ).toString();
    
          try {
            await schema.validateMessage(testMessage, Encodings.Json);
          } catch (e) {
            console.log(e, e.message, e.toString());
            assert.strictEqual(e, undefined, 'Error thrown by validateSchema');
          }
    
          const badMessage = '{"foo":"bar"}';
    
          try {
            await schema.validateMessage(badMessage, Encodings.Json);
          } catch (e) {
            assert.ok(e);
          }
    
          const fakeMessage = 'woohoo i am a message, no really';
    
          try {
            await schema.validateMessage(fakeMessage, Encodings.Json);
          } catch (e) {
            assert.ok(e);
          }
        }); */
    });
    (0, mocha_1.it)('should allow closing of publisher clients', async () => {
        // The full call stack of close() is tested in unit tests; this is mostly
        // to verify that the close() method is actually there and doesn't error.
        const localPubsub = new src_1.PubSub();
        // Just use the client object to make sure it has opened a connection.
        await pubsub.getTopics();
        // Tell it to close, and validate that it's marked closed.
        await localPubsub.close();
        assert.strictEqual(localPubsub.isOpen, false);
    });
});
//# sourceMappingURL=pubsub.js.map