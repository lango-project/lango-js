import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 192 scopes a catch binding to its catch body", () => {
    assert.doesNotThrow(() => compile(`main(args)
    try
        throw "failed"
    catch error
        callback = ()
            capture error
            return error
        println(callback())
`));
    assert.throws(
        () => compile(`main(args)
    try
        throw "failed"
    catch error
        println(error)
    callback = ()
        capture error
        return error
`),
        (error) => error instanceof LangoError && error.code === "LNG1212",
    );
});
