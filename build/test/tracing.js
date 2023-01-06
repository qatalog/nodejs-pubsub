"use strict";
/*!
 * Copyright 2021 Google LLC. All Rights Reserved.
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
exports.provider = exports.exporter = void 0;
const tracing_1 = require("@opentelemetry/tracing");
/**
 * This file is used to initialise a global tracing provider and span exporter
 * for our tests used in our project. This was the only way I was able to get
 * the tracing tests to work.
 *
 * Now before each test related or touches Opentelemetry
 * we are resetting the exporter defined below to ensure there are no spans
 * from previous tests still in memory. This is achived by calling `reset`
 * on the exporter in the unit tests while keeping one instance of
 * the trace provider and exporter.
 *
 * The tracing provider is being registered as a global trace provider before
 * we are importing our actual code which uses the Opentelemetry API to ensure
 * its defined beforehand.
 */
exports.exporter = new tracing_1.InMemorySpanExporter();
exports.provider = new tracing_1.BasicTracerProvider();
exports.provider.addSpanProcessor(new tracing_1.SimpleSpanProcessor(exports.exporter));
exports.provider.register();
//# sourceMappingURL=tracing.js.map