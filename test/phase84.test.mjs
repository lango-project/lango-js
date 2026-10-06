import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 84 does not allow an inherited public method to become private", () => {
    assert.throws(
        () => compile(`class Base
    methods
        run()

class Child : Base

Base:run()
    return 1

Child:run()
    return 2
`),
        (error) => error instanceof LangoError && error.code === "LNG1238",
    );
});

test("Faz 84 reserves an ancestor private method name", () => {
    assert.throws(
        () => compile(`class Base

class Child : Base

Base:hidden()
    return 1

Child:hidden()
    return 2
`),
        (error) => error instanceof LangoError && error.code === "LNG1237",
    );
});
