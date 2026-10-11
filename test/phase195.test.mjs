import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 195 rejects use of a catch binding in finally", () => {
    assert.throws(
        () => compile(`main(args)
    try
        throw "failed"
    catch error
        println(error)
    finally
        println(error)
`),
        (error) => error instanceof LangoError && error.code === "LNG1261",
    );
});
