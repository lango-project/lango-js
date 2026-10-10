import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.mjs";

test("Faz 184 does not mark a mixed-branch callable as definitely host", () => {
    assert.doesNotThrow(() => compile(`main(args)
    if true
        request = fetch
      else
          request = local_request
    $amount = 12.50
    request($amount)

local_request($amount)
    return $amount
`));
});
