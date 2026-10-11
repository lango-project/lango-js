import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.mjs";

test("Faz 204 excludes returning switch cases from definite-assignment joins", () => {
    assert.doesNotThrow(() => compile(`main(args)
    switch args[0]
      case "done"
          return 0
      else
          value = 1
    return value
`));
});
