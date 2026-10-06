import assert from "node:assert/strict";
import { compile, LangoError } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 77 rejects instance-property access from static methods", () => {
    assert.throws(
        () => compile(`class Counter

Counter::read()
    return @value
`),
        (error) => error instanceof LangoError && error.code === "LNG1231",
    );
    assert.throws(
        () => compile(`class Counter

Counter::set()
    _value = 1
`),
        (error) => error instanceof LangoError && error.code === "LNG1231",
    );
    assert.doesNotThrow(() => compile(`class Counter
    static
        count = 0

Counter::next()
    @@count = @@count + 1
`));
});
