import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.mjs";

test("Faz 198 treats a catch parameter as assigned inside its catch block", () => {
    assert.doesNotThrow(() => compile(`main(args)
    try
        throw "failed"
    catch error
        println(error)
        error = "handled"
        println(error)
`));
});
