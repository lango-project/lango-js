import assert from "node:assert/strict";
import { compile } from "../src/compiler.mjs";
import test from "node:test";

test("Phase 248 assigns through nested public properties", () => {
    const output = compile(`main(args)
    form.saveButton.enabled = false
`).javascript;
    assert.match(output, /form\.saveButton\.enabled = false;/);
});
