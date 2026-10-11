import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 200 checks update and method-call receivers for definite assignment", () => {
    for (const source of [`main(args)
    if args[0]
        value = 0
    value++
`, `main(args)
    if args[0]
        items = []
    items.add(1)
`])
        assert.throws(
            () => compile(source),
            (error) => error instanceof LangoError && error.code === "LNG1246",
        );
});
