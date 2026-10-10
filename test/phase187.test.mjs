import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 187 retains Decimal checks through an args host-returning function", () => {
    assert.throws(
        () => compile(`main(args)
    send = get_sender(args)
    $amount = 12.50
    send($amount)

get_sender(args)
    return args[0].send
`),
        (error) => error instanceof LangoError && error.code === "LNG1252",
    );
});
