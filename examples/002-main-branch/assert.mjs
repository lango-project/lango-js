import assert from "node:assert/strict";

import { configure } from "./.lango/runtime.mjs";
import { main } from "./expected.mjs";

const output = [];

configure({
    output: (value) => output.push(value),
});

assert.equal(main([]), null);
assert.equal(main(["Savaş"]), null);
assert.deepEqual(output, ["Hello, world", "Hello, Savaş"]);

configure({
    catalog: {
        "Hello, {0}": "Merhaba, {0}",
    },
    output: (value) => output.push(value),
});

assert.equal(main(["Savaş"]), null);
assert.deepEqual(output, ["Hello, world", "Hello, Savaş", "Merhaba, Savaş"]);
