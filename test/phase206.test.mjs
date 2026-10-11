import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.mjs";

test("Faz 206 allows captures assigned on every reaching switch or try path", () => {
    assert.doesNotThrow(() => compile(`main(args)
    switch args[0]
      case "done"
          return 0
      else
          value = 1
    callback = ()
        capture value
        return value
    return callback()
`));
    assert.doesNotThrow(() => compile(`main(args)
    try
        return 0
    catch error
        value = 1
    callback = ()
        capture value
        return value
    return callback()
`));
});
