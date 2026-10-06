import assert from "node:assert/strict";
import { compile } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 33 validates property captures against their class", () => {
    assert.throws(
        () => compile(`class Counter
    methods
        callback()

Counter:callback()
    callback = ()
        capture @cout
        return @cout
`),
        /LNG1214.*unknown captured property @cout/,
    );
    assert.throws(
        () => compile(`main(args)
    callback = ()
        capture @count
        return @count
`),
        /LNG1213.*@count is only valid in a class method/,
    );
});
