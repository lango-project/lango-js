import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 191 scopes key-value loop bindings to their loop body", () => {
    assert.doesNotThrow(() => compile(`main(args)
    for args[0] as key: value
        callback = ()
            capture key, value
            return key + value
        println(callback())
`));
    assert.throws(
        () => compile(`main(args)
    for args[0] as key: value
        println(value)
    callback = ()
        capture key
        return key
`),
        (error) => error instanceof LangoError && error.code === "LNG1212",
    );
});
