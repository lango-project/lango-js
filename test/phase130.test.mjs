import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 130 infers a nested compound Decimal result from a function", () => {
    assert.throws(
        () => compile(`total()
    return ($9007199254740993 + $1) * ($2 + $3)

main(args)
    total = total()
    return null
`),
        (error) => error instanceof LangoError && error.code === "LNG1244",
    );
});

test("Faz 130 keeps Decimal comparisons typed as Boolean results", () => {
    assert.doesNotThrow(() => compile(`matches()
    return ($1 + $2) == $3

main(args)
    matches = matches()
    return matches
`));
});
