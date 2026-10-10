import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 185 retains Decimal checks through a host-returning Lango function", () => {
    assert.throws(
        () => compile(`main(args)
    request = make_request()
    $amount = 12.50
    request($amount)

make_request()
    return fetch
`),
        (error) => error instanceof LangoError && error.code === "LNG1252",
    );
    assert.doesNotThrow(() => compile(`main(args)
    request = make_request()
    $amount = 12.50
    request(to_js_number($amount))

make_request()
    return fetch
`));
});
