import assert from "node:assert/strict";
import { compile, LangoError } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 212 groups independent declaration diagnostics", () => {
    const source = `math(value)
    return value
`;
    assert.throws(
        () => compile(source, "sample.lango", [
            { names: ["sum as math"] },
            { names: ["subtract as math"] },
        ]),
        (error) => {
            assert.ok(error instanceof LangoError);
            assert.equal(error.code, "LNG1228");
            assert.deepEqual(
                error.diagnostics.map((item) => item.code),
                ["LNG1228", "LNG1229"],
            );
            return true;
        },
    );
});
