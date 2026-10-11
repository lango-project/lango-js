import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.mjs";

test("Faz 188 recognizes a switch-assigned capture on every branch", () => {
    assert.doesNotThrow(() => compile(`main(args)
    switch true
      case true
          value = 1
      else
          value = 2
    callback = ()
        capture value
        return value
    return callback()
`));
});
