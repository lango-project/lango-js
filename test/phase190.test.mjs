import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 190 scopes loop bindings to their loop body", () => {
    assert.doesNotThrow(() => compile(`main(args)
    for args as item
        callback = ()
            capture item
            return item
        println(callback())
`));
    assert.throws(
        () => compile(`main(args)
    for args as item
        println(item)
    callback = ()
        capture item
        return item
`),
        (error) => error instanceof LangoError && error.code === "LNG1212",
    );
});
