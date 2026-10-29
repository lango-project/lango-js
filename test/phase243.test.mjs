import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.mjs";

test("Phase 243 emits dynamic ESM import from import_module", () => {
    const output = compile(`load(path)
    return import_module(path)
`).javascript;
    assert.match(output, /return import\(path\)/);
});
