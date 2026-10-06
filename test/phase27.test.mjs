import assert from "node:assert/strict";
import { compile } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 27 emits a standalone Lango function call", () => {
    const output = compile(`export main(args)

finish()
    return

main(args)
    finish()
`).javascript;
    assert.match(output, /    finish\(\);/);
});
