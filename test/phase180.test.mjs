import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 180 retains Decimal checks through a definitely assigned host alias", () => {
    assert.throws(
        () => compile(`main(args)
    if true
        request = fetch
      else
          request = fetch
    $amount = 12.50
    request($amount)
`),
        (error) => error instanceof LangoError && error.code === "LNG1252",
    );
});
