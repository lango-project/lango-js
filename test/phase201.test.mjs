import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 201 checks direct local callable statements for definite assignment", () => {
    assert.throws(
        () => compile(`main(args)
    if args[0]
        handler = ()
            println("handled")
    handler()
`),
        (error) => error instanceof LangoError && error.code === "LNG1246",
    );
});
