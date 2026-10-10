import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 181 retains Decimal checks through try and catch host aliases", () => {
    assert.throws(
        () => compile(`main(args)
    try
        request = fetch
    catch error
        request = fetch
    $amount = 12.50
    request($amount)
`),
        (error) => error instanceof LangoError && error.code === "LNG1252",
    );
});
