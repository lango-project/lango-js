import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 189 does not treat a switch without else as definite assignment", () => {
    assert.throws(
        () => compile(`main(args)
    switch true
      case true
          value = 1
    callback = ()
        capture value
        return value
    return callback()
`),
        (error) => error instanceof LangoError && error.code === "LNG1212",
    );
});
