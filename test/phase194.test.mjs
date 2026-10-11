import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 194 rejects a catch binding used from a nested block after its catch", () => {
    assert.throws(
        () => compile(`main(args)
    try
        throw "failed"
    catch error
        println(error)
    if true
        println(error)
`),
        (error) => error instanceof LangoError && error.code === "LNG1261",
    );
});
