import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 86 validates required ancestor constructor arguments at super", () => {
    assert.throws(
        () => compile(`class Base

class Child : Base

Base(value)
    @value = value

Child()
    super()
`),
        (error) =>
            error instanceof LangoError &&
            error.code === "LNG1203" &&
            /super for Child/.test(error.message),
    );
});

test("Faz 86 permits a defaulted ancestor constructor argument at super", () => {
    assert.doesNotThrow(() =>
        compile(`class Base

class Child : Base

Base(value = 1)
    @value = value

Child()
    super()
`),
    );
});
