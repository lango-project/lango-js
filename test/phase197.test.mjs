import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 197 checks definite assignment in loop collections", () => {
    assert.throws(
        () => compile(`main(args)
    if args[0]
        values = [1]
    for values as value
        println(value)
`),
        (error) => error instanceof LangoError && error.code === "LNG1246",
    );
});
