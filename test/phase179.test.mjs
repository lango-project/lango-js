import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 179 retains Decimal checks through copied host callable aliases", () => {
    assert.throws(
        () => compile(`main(args)
    send = args[0].send
    later = send
    $amount = 12.50
    later($amount)
`),
        (error) => error instanceof LangoError && error.code === "LNG1252",
    );
    assert.doesNotThrow(() => compile(`main(args)
    send = args[0].send
    later = send
    $amount = 12.50
    later(to_js_number($amount))
`));
});
