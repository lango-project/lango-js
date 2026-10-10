import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 138 infers a Decimal return through null coalescing", () => {
    assert.throws(
        () => compile(`total()
    return null ?? ($9007199254740993 + $1)

main(args)
    total = total()
    return null
`),
        (error) => error instanceof LangoError && error.code === "LNG1244",
    );
});

test("Faz 138 does not infer Decimal from a non-Decimal coalescing result", () => {
    assert.doesNotThrow(() => compile(`label()
    return null ?? "fallback"

main(args)
    label = label()
    return label
`));
});
