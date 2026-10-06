import assert from "node:assert/strict";
import { compile } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 56 rejects colliding static member names", () => {
    assert.throws(
        () => compile(`class Counter
    static
        limit = 10
        limit()

Counter::limit()
    return 20
`),
        /LNG1224.*duplicate static member limit/,
    );
    assert.throws(
        () => compile(`class Counter
    static
        limit = 10
    enum
        limit = 20
`),
        /LNG1224.*duplicate static member limit/,
    );
});

test("Faz 56 permits distinct static values and methods", () => {
    assert.doesNotThrow(() => compile(`class Counter
    static
        limit = 10
        create(start)

Counter::create(start)
    return new Counter()
`));
});
