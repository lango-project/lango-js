import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 193 rejects direct use of a catch binding after its catch block", () => {
    assert.throws(
        () => compile(`main(args)
    try
        throw "failed"
    catch error
        println(error)
    println(error)
`),
        (error) => error instanceof LangoError && error.code === "LNG1261",
    );
});
