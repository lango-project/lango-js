import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 199 applies definite-assignment checks to Lango tests and methods", () => {
    assert.throws(
        () => compile(`test "conditional local"
    if true
        value = 1
    println(value)
`),
        (error) => error instanceof LangoError && error.code === "LNG1246",
    );
    assert.throws(
        () => compile(`class Example

Example:run()
    if true
        value = 1
    return value
`),
        (error) => error instanceof LangoError && error.code === "LNG1246",
    );
});
