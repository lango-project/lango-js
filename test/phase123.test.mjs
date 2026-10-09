import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 123 lowers inclusive comparison operators", () => {
    const output = compile(`main(args)
    return 2 <= 2 and 3 >= 2
`).javascript;
    assert.match(output, /2 <= 2/);
    assert.match(output, /3 >= 2/);
});

test("Faz 123 retains non-coercive inclusive comparisons", () => {
    assert.throws(
        () => compile(`main(args)
    return "2" >= 1
`),
        (error) => error instanceof LangoError && error.code === "LNG1254",
    );
});
