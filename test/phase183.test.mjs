import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.mjs";

test("Faz 183 clears host alias tracking after reassignment", () => {
    assert.doesNotThrow(() => compile(`main(args)
    request = fetch
    request = local_request
    $amount = 12.50
    request($amount)

local_request($amount)
    return $amount
`));
});
