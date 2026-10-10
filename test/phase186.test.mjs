import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 186 retains Decimal checks through transitive host-returning functions", () => {
    assert.throws(
        () => compile(`main(args)
    request = make_request()
    $amount = 12.50
    request($amount)

make_request()
    return base_request()

base_request()
    return fetch
`),
        (error) => error instanceof LangoError && error.code === "LNG1252",
    );
});
