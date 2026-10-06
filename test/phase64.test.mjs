import assert from "node:assert/strict";
import { compile, LangoError } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 64 rejects non-finite numeric literals at compile time", () => {
    assert.throws(
        () => compile(`main(args)
    value = 1e999
`),
        (error) =>
            error instanceof LangoError &&
            error.code === "LNG1120" &&
            /numeric literal must be finite/.test(error.message),
    );
    assert.doesNotThrow(() => compile(`main(args)
    value = 1e308
`));
});
