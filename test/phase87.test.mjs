import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 87 rejects unknown methods on a known Lango class", () => {
    assert.throws(
        () => compile(`class Counter

Counter:read()
    return this.missing()
`),
        (error) => error instanceof LangoError && error.code === "LNG1241",
    );
});

test("Faz 87 preserves class-method privacy across receivers and inheritance", () => {
    assert.throws(
        () => compile(`class Base

class Child : Base

Base:hidden()
    return 1

Child:read()
    return this.hidden()
`),
        (error) => error instanceof LangoError && error.code === "LNG1242",
    );
    assert.throws(
        () => compile(`class Counter

Counter::hidden()
    return 1

run()
    return Counter.hidden()
`),
        (error) => error instanceof LangoError && error.code === "LNG1242",
    );
});
