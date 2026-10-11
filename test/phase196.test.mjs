import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 196 tracks definite assignments across switch branches", () => {
    assert.doesNotThrow(() => compile(`main(args)
    switch args[0]
      case "a"
          value = 1
      else
          value = 2
    return value
`));
    assert.throws(
        () => compile(`main(args)
    switch args[0]
      case "a"
          value = 1
    return value
`),
        (error) => error instanceof LangoError && error.code === "LNG1246",
    );
});
