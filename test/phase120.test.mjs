import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.mjs";

test("Faz 120 evaluates additive chains from left to right", () => {
    const output = compile(`main(args)
    return 10 - 3 + 2
`).javascript;
    assert.match(output, /return __finite\(__finite\(10 - 3\) \+ 2\)/);
});

test("Faz 120 evaluates multiplicative chains from left to right", () => {
    const output = compile(`main(args)
    return 12 \/ 3 \* 2
`).javascript;
    assert.match(output, /return __finite\(__finite\(12 \/ 3\) \* 2\)/);
});
