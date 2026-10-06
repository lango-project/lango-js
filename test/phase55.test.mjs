import assert from "node:assert/strict";
import { compile } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 55 requires public method declarations to match implementations", () => {
    assert.throws(
        () => compile(`class Counter
    methods
        add(amount)

Counter:add(value)
    return value
`),
        /LNG1223.*signature does not match/,
    );
    assert.doesNotThrow(() => compile(`class Counter
    static
        create(start)

Counter::create(start)
    return new Counter()
`));
    assert.throws(
        () => compile(`class Counter
    methods
        add(amount = 1)

Counter:add(amount = 2)
    return amount
`),
        /LNG1223.*signature does not match/,
    );
});
