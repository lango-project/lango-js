import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.mjs";

test("Faz 203 allows captures assigned on every reaching if path", () => {
    assert.doesNotThrow(() => compile(`main(args)
    if args[0]
        return 0
      else
          value = 1
    callback = ()
        capture value
        return value
    return callback()
`));
});
