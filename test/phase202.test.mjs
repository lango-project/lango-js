import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.mjs";

test("Faz 202 excludes returning if branches from definite-assignment joins", () => {
    assert.doesNotThrow(() => compile(`main(args)
    if args[0]
        return 0
      else
          value = 1
    return value
`));
});
