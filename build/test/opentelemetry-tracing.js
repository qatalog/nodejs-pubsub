"use strict";
/*!
 * Copyright 2020 Google LLC
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
const api = require("@opentelemetry/api");
const opentelemetry_tracing_1 = require("../src/opentelemetry-tracing");
const tracing_1 = require("./tracing");
const api_1 = require("@opentelemetry/api");
(0, mocha_1.describe)('OpenTelemetryTracer', () => {
    let span;
    const spanName = 'test-span';
    const spanContext = {
        traceId: 'd4cda95b652f4a1592b449d5929fda1b',
        spanId: '6e0c63257de34c92',
        traceFlags: api.TraceFlags.SAMPLED,
    };
    const spanAttributes = {
        foo: 'bar',
    };
    (0, mocha_1.beforeEach)(() => {
        tracing_1.exporter.reset();
    });
    (0, mocha_1.it)('creates a span', () => {
        span = (0, opentelemetry_tracing_1.createSpan)(spanName, api_1.SpanKind.PRODUCER, spanAttributes, spanContext);
        span.end();
        const spans = tracing_1.exporter.getFinishedSpans();
        assert.notStrictEqual(spans.length, 0);
        const exportedSpan = spans.concat().pop();
        assert.strictEqual(exportedSpan.name, spanName);
        assert.deepStrictEqual(exportedSpan.attributes, spanAttributes);
        assert.strictEqual(exportedSpan.parentSpanId, spanContext.spanId);
        assert.strictEqual(exportedSpan.kind, api_1.SpanKind.PRODUCER);
    });
});
//# sourceMappingURL=opentelemetry-tracing.js.map