import assert from "node:assert/strict";
import { compile, LangoError } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 60 statically validates direct constructor and class-method calls", () => {
    assert.throws(
        () => compile(`class Counter
    methods
        add(value)
    static
        create(start)

Counter(start)
    _start = start

Counter:add(value)
    return value

Counter::create(start)
    return new Counter(start)

main(args)
    Counter.create()
`),
        (error) =>
            error instanceof LangoError &&
            error.code === "LNG1203" &&
            /Counter::create.*argument 1/.test(error.message),
    );
    assert.throws(
        () => compile(`class Counter

Counter(start)
    _start = start

main(args)
    counter = new Counter()
`),
        (error) =>
            error instanceof LangoError &&
            error.code === "LNG1203" &&
            /Counter.*argument 1/.test(error.message),
    );
});

test("Faz 60 permits excess arguments for direct class calls", () => {
    assert.doesNotThrow(() => compile(`class Counter
    static
        create(start)

Counter(start)
    _start = start

Counter::create(start)
    return new Counter(start, "ignored")

main(args)
    Counter.create(1, "ignored")
`));
});
