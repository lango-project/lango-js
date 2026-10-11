import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.mjs";

test("Faz 205 excludes returning try paths from definite-assignment joins", () => {
    assert.doesNotThrow(() => compile(`main(args)
    try
        return 0
    catch error
        value = 1
    return value
`));
});
