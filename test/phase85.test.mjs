import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 85 requires super.method to name a public ancestor instance method", () => {
    assert.throws(
        () => compile(`class Base

class Child : Base

Child:run()
    return super.missing()
`),
        (error) => error instanceof LangoError && error.code === "LNG1240",
    );
    assert.throws(
        () => compile(`class Base

class Child : Base

Base:hidden()
    return 1

Child:run()
    return super.hidden()
`),
        (error) => error instanceof LangoError && error.code === "LNG1240",
    );
});

test("Faz 85 forbids super.method from a static method", () => {
    assert.throws(
        () => compile(`class Base
    static
        run()

class Child : Base
    static
        run()

Base::run()
    return 1

Child::run()
    return super.run()
`),
        (error) => error instanceof LangoError && error.code === "LNG1239",
    );
});
