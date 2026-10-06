import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.mjs";

test("Faz 92 accepts comments without treating hashes inside strings as comments", () => {
    const output = compile(`# file note
export main(args) # entry point

main(args)
    # body note
    return "a#b" # result
`).javascript;
    assert.match(output, /return "a#b";/);
});
