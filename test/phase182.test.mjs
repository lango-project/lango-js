import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 182 retains Decimal checks through a finally host alias", () => {
    assert.throws(
        () => compile(`main(args)
    try
        request = fetch
    finally
        request = fetch
    $amount = 12.50
    request($amount)
`),
        (error) => error instanceof LangoError && error.code === "LNG1252",
    );
    assert.doesNotThrow(() => compile(`main(args)
    try
        request = fetch
    finally
        request = fetch
    $amount = 12.50
    request(to_js_number($amount))
`));
});
