import assert from "node:assert/strict";
import { compile, LangoError } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 214 does not leak definite assignments through a non-completing finally", () => {
    assert.throws(
        () => compile(`main(args)
    try
        println("work")
    finally
        value = 1
        return
    return value
`),
        (error) => error instanceof LangoError && error.code === "LNG1246",
    );
});

test("Faz 214 does not let a non-completing finally establish closure captures", () => {
    assert.throws(
        () => compile(`main(args)
    try
        println("work")
    finally
        value = 1
        return
    callback = ()
        capture value
        return value
`),
        (error) => error instanceof LangoError && error.code === "LNG1212",
    );
});

test("Faz 214 treats a throwing finally as a non-normal exit", () => {
    assert.throws(
        () => compile(`main(args)
    try
        println("work")
    finally
        value = 1
        throw "stop"
    return value
`),
        (error) => error instanceof LangoError && error.code === "LNG1246",
    );
});
