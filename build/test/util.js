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
const util_1 = require("../src/util");
const assert = require("assert");
(0, mocha_1.describe)('utils', () => {
    (0, mocha_1.describe)('Throttler', () => {
        (0, mocha_1.it)('does not allow too many calls through at once', () => {
            const throttler = new util_1.Throttler(300);
            let totalCalls = '';
            // This one should succeed.
            throttler.doMaybe(() => {
                totalCalls += 'FIRST';
            });
            // This one should fail.
            throttler.doMaybe(() => {
                totalCalls += 'SECOND';
            });
            // Simulate time passing.
            throttler.lastTime -= 1000;
            // This one should succeed.
            throttler.doMaybe(() => {
                totalCalls += 'THIRD';
            });
            assert.strictEqual(totalCalls, 'FIRSTTHIRD');
        });
    });
    (0, mocha_1.describe)('addToBucket', () => {
        (0, mocha_1.it)('adds to a non-existent bucket', () => {
            const map = new Map();
            (0, util_1.addToBucket)(map, 'a', 'b');
            assert.deepStrictEqual(map.get('a'), ['b']);
        });
        (0, mocha_1.it)('adds to an existent bucket', () => {
            const map = new Map();
            map.set('a', ['c']);
            (0, util_1.addToBucket)(map, 'a', 'b');
            assert.deepStrictEqual(map.get('a'), ['c', 'b']);
        });
    });
});
//# sourceMappingURL=util.js.map