import assert from "node:assert/strict";
import { compile } from "../src/compiler.mjs";
import test from "node:test";

test("Phase 249 gives word logical operators lower precedence than symbolic operators", () => {
    const output = compile(`main(a, b)
    return not !a && b
`).javascript;
    assert.match(output, /return !__requireBoolean\(!__requireBoolean\(a\) && b\);/);
});
