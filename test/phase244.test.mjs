import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.mjs";

test("Phase 244 calls a function selected by an object index", () => {
    const output = compile(`invoke(module, name, input)
    return module[name](input)
`).javascript;
    assert.match(output, /return __call\(module\[name\], input\)/);
});
