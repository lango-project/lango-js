import assert from "node:assert/strict";
import { compile } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 57 rejects colliding public instance API names", () => {
    assert.throws(
        () => compile(`class Counter
    properties
        value
    methods
        value()

Counter:value()
    return 1
`),
        /LNG1225.*duplicate public instance member value/,
    );
    assert.throws(
        () => compile(`class Counter
    methods
        value()
        value()

Counter:value()
    return 1
`),
        /LNG1225.*duplicate public instance member value/,
    );
});

test("Faz 57 rejects duplicate implementations but permits static and instance pairs", () => {
    assert.throws(
        () => compile(`class Counter

Counter:value()
    return 1

Counter:value()
    return 2
`),
        /LNG1226.*duplicate instance method value/,
    );
    assert.doesNotThrow(() => compile(`class Counter
    methods
        value()
    static
        value()

Counter:value()
    return 1

Counter::value()
    return 2
`));
});
