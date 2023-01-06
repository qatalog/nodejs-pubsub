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
const ack_metadata_1 = require("../src/ack-metadata");
const google_gax_1 = require("google-gax");
const subscriber_1 = require("../src/subscriber");
(0, mocha_1.describe)('ack-metadata', () => {
    (0, mocha_1.it)('deals with no ErrorInfo', () => {
        const error = {};
        const results = (0, ack_metadata_1.processAckErrorInfo)(error);
        assert.strictEqual(results.size, 0);
    });
    (0, mocha_1.it)('handles permanent errors', () => {
        const ackId = '12345';
        const errorCode = 'PERMANENT_FAILURE_INVALID_ACK_ID';
        const error = {
            errorInfoMetadata: {
                [ackId]: errorCode,
            },
        };
        const results = (0, ack_metadata_1.processAckErrorInfo)(error);
        assert.deepStrictEqual(Array.from(results.entries()), [
            [
                ackId,
                {
                    transient: false,
                    response: subscriber_1.AckResponses.Invalid,
                    rawErrorCode: errorCode,
                },
            ],
        ]);
    });
    (0, mocha_1.it)('handles transient errors', () => {
        const ackId = '12345';
        const errorCode = 'TRANSIENT_FAILURE_ESPRESSO_BAR_CLOSED';
        const error = {
            errorInfoMetadata: {
                [ackId]: errorCode,
            },
        };
        const results = (0, ack_metadata_1.processAckErrorInfo)(error);
        assert.deepStrictEqual(Array.from(results.entries()), [
            [
                ackId,
                {
                    transient: true,
                    rawErrorCode: errorCode,
                },
            ],
        ]);
    });
    (0, mocha_1.it)('handles other errors', () => {
        const ackId = '12345';
        const errorCode = 'NO_IDEA_ERROR';
        const error = {
            errorInfoMetadata: {
                [ackId]: errorCode,
            },
        };
        const results = (0, ack_metadata_1.processAckErrorInfo)(error);
        assert.deepStrictEqual(Array.from(results.entries()), [
            [
                ackId,
                {
                    transient: false,
                    response: subscriber_1.AckResponses.Other,
                    rawErrorCode: errorCode,
                },
            ],
        ]);
    });
    (0, mocha_1.it)('handles multiple responses', () => {
        const ackIds = ['12345', '23456', '34567'];
        const errorCodes = [
            'PERMANENT_FAILURE_INVALID_ACK_ID',
            'TRANSIENT_FAILURE_ESPRESSO_BAR_CLOSED',
            'NO_IDEA_ERROR',
        ];
        const expectedResults = new Map([
            [
                ackIds[0],
                {
                    transient: false,
                    response: subscriber_1.AckResponses.Invalid,
                    rawErrorCode: errorCodes[0],
                },
            ],
            [
                ackIds[1],
                {
                    transient: true,
                    rawErrorCode: errorCodes[1],
                },
            ],
            [
                ackIds[2],
                {
                    transient: false,
                    response: subscriber_1.AckResponses.Other,
                    rawErrorCode: errorCodes[2],
                },
            ],
        ]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metaData = {};
        for (let i = 0; i < ackIds.length; i++) {
            metaData[ackIds[i]] = errorCodes[i];
        }
        const error = {
            errorInfoMetadata: metaData,
        };
        const results = (0, ack_metadata_1.processAckErrorInfo)(error);
        ackIds.forEach(id => {
            const ackError = results.get(id);
            const expected = expectedResults.get(id);
            assert.deepStrictEqual(ackError, expected);
        });
    });
    (0, mocha_1.it)('handles gRPC errors', () => {
        const testTable = [
            {
                code: google_gax_1.Status.DEADLINE_EXCEEDED,
                result: {
                    transient: true,
                    grpcErrorCode: google_gax_1.Status.DEADLINE_EXCEEDED,
                    response: subscriber_1.AckResponses.Other,
                },
            },
            {
                code: google_gax_1.Status.RESOURCE_EXHAUSTED,
                result: {
                    transient: true,
                    grpcErrorCode: google_gax_1.Status.RESOURCE_EXHAUSTED,
                    response: subscriber_1.AckResponses.Other,
                },
            },
            {
                code: google_gax_1.Status.ABORTED,
                result: {
                    transient: true,
                    grpcErrorCode: google_gax_1.Status.ABORTED,
                    response: subscriber_1.AckResponses.Other,
                },
            },
            {
                code: google_gax_1.Status.INTERNAL,
                result: {
                    transient: true,
                    grpcErrorCode: google_gax_1.Status.INTERNAL,
                    response: subscriber_1.AckResponses.Other,
                },
            },
            {
                code: google_gax_1.Status.UNAVAILABLE,
                result: {
                    transient: true,
                    grpcErrorCode: google_gax_1.Status.UNAVAILABLE,
                    response: subscriber_1.AckResponses.Other,
                },
            },
            {
                code: google_gax_1.Status.PERMISSION_DENIED,
                result: {
                    transient: false,
                    grpcErrorCode: google_gax_1.Status.PERMISSION_DENIED,
                    response: subscriber_1.AckResponses.PermissionDenied,
                },
            },
            {
                code: google_gax_1.Status.FAILED_PRECONDITION,
                result: {
                    transient: false,
                    grpcErrorCode: google_gax_1.Status.FAILED_PRECONDITION,
                    response: subscriber_1.AckResponses.FailedPrecondition,
                },
            },
            {
                code: google_gax_1.Status.UNIMPLEMENTED,
                result: {
                    transient: false,
                    grpcErrorCode: google_gax_1.Status.UNIMPLEMENTED,
                    response: subscriber_1.AckResponses.Other,
                },
            },
        ];
        for (const t of testTable) {
            const result = (0, ack_metadata_1.processAckRpcError)(t.code);
            assert.deepStrictEqual(result, t.result);
        }
    });
});
//# sourceMappingURL=ack-metadata.js.map