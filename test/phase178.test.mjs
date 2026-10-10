import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 178 retains Decimal checks through an args host callable alias", () => {
    assert.throws(
        () => compile(`main(args)
    send = args[0].send
    $amount = 12.50
    send($amount)
`),
        (error) => error instanceof LangoError && error.code === "LNG1252",
    );
    assert.doesNotThrow(() => compile(`main(args)
    send = args[0].send
    $amount = 12.50
    send(to_js_number($amount))
`));
});
