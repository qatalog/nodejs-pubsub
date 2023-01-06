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
const temporal_1 = require("../src/temporal");
const assert = require("assert");
(0, mocha_1.describe)('temporal', () => {
    (0, mocha_1.describe)('Duration', () => {
        (0, mocha_1.it)('can be created from millis', () => {
            const duration = temporal_1.Duration.from({ millis: 1234 });
            assert.strictEqual(duration.totalOf('second'), 1.234);
        });
        (0, mocha_1.it)('can be created from seconds', () => {
            const duration = temporal_1.Duration.from({ seconds: 1.234 });
            assert.strictEqual(duration.totalOf('millisecond'), 1234);
        });
        (0, mocha_1.it)('can be created from minutes', () => {
            const duration = temporal_1.Duration.from({ minutes: 30 });
            assert.strictEqual(duration.totalOf('hour'), 0.5);
        });
        (0, mocha_1.it)('can be created from hours', () => {
            const duration = temporal_1.Duration.from({ hours: 1.5 });
            assert.strictEqual(duration.totalOf('minute'), 90);
        });
    });
});
//# sourceMappingURL=temporal.js.map