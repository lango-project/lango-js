import assert from "node:assert/strict";
import { compile } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 227 follows break paths for definite assignment inside a loop", () => {
    assert.doesNotThrow(() => compile(`main(args)
    loop
        if args[0]
            value = 1
          else
              break
        println(value)
`));
});

test("Faz 227 follows continue paths for closure captures inside a loop", () => {
    assert.doesNotThrow(() => compile(`main(args)
    loop
        if args[0]
            value = 1
          else
              continue
        callback = ()
            capture value
            return value
`));
});
