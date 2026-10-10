import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 176 requires explicit Decimal conversion for direct args host methods", () => {
    assert.throws(
        () => compile(`main(args)
    $amount = 12.50
    args[0].write($amount)
`),
        (error) => error instanceof LangoError && error.code === "LNG1252",
    );
    assert.doesNotThrow(() => compile(`main(args)
    $amount = 12.50
    args[0].write(to_js_number($amount))
`));
});
